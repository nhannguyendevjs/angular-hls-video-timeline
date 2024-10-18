import { CdkDragEnd, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterOutlet } from '@angular/router';
import Hls from 'hls.js';

const STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export type Player = {
  width: number; // in pixels
  duration: number; // in seconds
  durationString: string; // in minutes:seconds
  currentTime: number; // in seconds
  currentTimeString: string; // in minutes:seconds
};

export type Timeline = {
  currentTime: number; // in seconds
  currentPixel: number; // in pixels
  startTime: number; // in seconds
  startTimeString: string; // in minutes:seconds
  startPixel: number; // in pixels
  trackBarPixel: number; // in pixels
  trackBarWidth: number; // in pixels
  endTime: number; // in seconds
  endPixel: number; // in pixels
  endTimeString: string; // in minutes:seconds
};

@Component({
  selector: 'app-comment-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Comment</h2>
    <mat-dialog-content>
      <mat-form-field class="w-full">
        <textarea matInput rows="4" class="resize-none"> </textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-button mat-dialog-close>Save</button>
    </mat-dialog-actions>
  `,
})
export class CommentDialogComponent {}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, DragDropModule, CommentDialogComponent, MatButtonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  dialog = inject(MatDialog);

  @ViewChild('video', { static: false }) video!: ElementRef<HTMLVideoElement>;
  @ViewChild('currentMarker', { static: false }) currentMarker!: ElementRef<HTMLElement>;

  hls = new Hls();

  player: Player = {
    width: 1024,
    duration: 0,
    durationString: '00:00',
    currentTime: 0,
    currentTimeString: '00:00',
  };

  timeline: Timeline = {
    currentTime: 0,
    currentPixel: 0,
    startTime: 0,
    startTimeString: '00:00',
    startPixel: 0,
    trackBarPixel: 0,
    trackBarWidth: 0,
    endTime: 0,
    endTimeString: '00:00',
    endPixel: 0,
  };

  lastTrackBarPixel = 0;
  lastStartPixel = 0;
  lastEndPixel = 0;

  ngAfterViewInit() {
    this.loadVideo();
    this.registerVideoEvents();
  }

  loadVideo() {
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(STREAM);
      hls.attachMedia(this.video.nativeElement);
    } else if (this.video.nativeElement.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.nativeElement.src = STREAM;
    }
  }

  registerVideoEvents() {
    // When the video is loaded, set the duration
    this.video.nativeElement.addEventListener('loadedmetadata', () => {
      this.player.duration = this.video.nativeElement.duration;
      this.player.durationString = this.#transformTimeToMinutes(this.video.nativeElement.duration);
    });
    // When the video is playing, update the current time
    this.video.nativeElement.addEventListener('timeupdate', () => {
      this.player.currentTime = this.video.nativeElement.currentTime;
      this.player.currentTimeString = this.#transformTimeToMinutes(this.video.nativeElement.currentTime);
      this.timeline.currentTime = this.video.nativeElement.currentTime;
      this.timeline.currentPixel = this.#transformTimeToPixel(this.video.nativeElement.currentTime);
    });
  }

  play() {
    this.video.nativeElement.play();
  }

  pause() {
    this.video.nativeElement.pause();
  }

  stop() {
    this.pause();
    this.video.nativeElement.currentTime = 0;
  }

  seek() {
    this.video.nativeElement.currentTime = this.player.duration / 2;
  }

  #transformTimeToMinutes(time: number) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes > 9 ? minutes : '0' + minutes.toString()}:${seconds > 9 ? seconds : '0' + seconds.toString()}`;
  }

  #transformTimeToPixel(time: number) {
    return (time * this.player.width) / this.player.duration;
  }

  #transformPixelToTime(pixel: number) {
    return (pixel * this.player.duration) / this.player.width;
  }

  updateCurrentMarker(ended: CdkDragEnd) {
    this.video.nativeElement.currentTime = this.#transformPixelToTime(ended.source.getFreeDragPosition().x);
  }

  #calculateTrackBarWidth() {
    this.timeline.trackBarWidth = this.timeline.endPixel - this.timeline.startPixel;
  }

  trackBarDragEnded(ended: CdkDragEnd) {
    this.timeline.trackBarPixel = this.lastTrackBarPixel + ended.distance.x;
    // Update start marker
    this.timeline.startPixel = this.lastStartPixel + ended.distance.x;
    this.timeline.startTime = this.#transformPixelToTime(this.timeline.startPixel);
    this.timeline.startTimeString = this.#transformTimeToMinutes(this.timeline.startTime);
    // Update end marker
    this.timeline.endPixel = this.lastEndPixel + ended.distance.x;
    this.timeline.endTime = this.#transformPixelToTime(this.timeline.endPixel);
    this.timeline.endTimeString = this.#transformTimeToMinutes(this.timeline.endTime);
    // Validate if the timeline is out of bounds
    if (this.timeline.endPixel > this.player.width || this.timeline.startPixel < 0) {
      // Update start marker
      this.timeline.startPixel = this.lastStartPixel;
      this.timeline.startTime = this.#transformPixelToTime(this.lastStartPixel);
      this.timeline.startTimeString = this.#transformTimeToMinutes(this.timeline.startTime);
      // Update end marker
      this.timeline.endPixel = this.lastEndPixel;
      this.timeline.endTime = this.#transformPixelToTime(this.lastEndPixel);
      this.timeline.endTimeString = this.#transformTimeToMinutes(this.timeline.endTime);

      this.timeline.trackBarPixel = this.lastEndPixel;
      const timeoutId = setTimeout(() => {
        this.timeline.trackBarPixel = this.lastTrackBarPixel;
        clearTimeout(timeoutId);
      }, 0);
    }
  }

  startDragMoved(ended: CdkDragMove) {
    const x = this.lastStartPixel + ended.distance.x;
    this.timeline.startTime = this.#transformPixelToTime(x);
    this.timeline.startTimeString = this.#transformTimeToMinutes(this.timeline.startTime);
  }

  startDragEnded(ended: CdkDragEnd) {
    const newStartPixel = this.lastStartPixel + ended.distance.x < 0 ? 0 : this.lastStartPixel + ended.distance.x;
    // Validate if the timeline is out of bounds
    if (newStartPixel >= this.timeline.endPixel) {
      this.timeline.startPixel = this.timeline.endPixel;
      const timeoutId = setTimeout(() => {
        this.timeline.startPixel = this.lastStartPixel;
        this.timeline.startTime = this.#transformPixelToTime(this.lastStartPixel);
        this.timeline.startTimeString = this.#transformTimeToMinutes(this.timeline.startTime);
        this.#calculateTrackBarWidth();
        clearTimeout(timeoutId);
      }, 0);
    } else {
      this.timeline.startPixel = newStartPixel;
      this.timeline.trackBarPixel = this.timeline.startPixel;
      this.#calculateTrackBarWidth();
    }
  }

  endDragMoved(ended: CdkDragMove) {
    const x = this.lastEndPixel + ended.distance.x + 4 === this.player.width ? this.player.width : this.lastEndPixel + ended.distance.x;
    this.timeline.endTime = this.#transformPixelToTime(x);
    this.timeline.endTimeString = this.#transformTimeToMinutes(this.timeline.endTime);
  }

  endDragEnded(ended: CdkDragEnd) {
    const newEndPixel = this.lastEndPixel + ended.distance.x + 4 > this.player.width ? this.player.width : this.lastEndPixel + ended.distance.x;
    // Validate if the timeline is out of bounds
    if (newEndPixel <= this.timeline.startPixel) {
      this.timeline.endPixel = this.timeline.startPixel;
      const timeoutId = setTimeout(() => {
        this.timeline.endPixel = this.lastEndPixel;
        this.timeline.endTime = this.#transformPixelToTime(this.lastEndPixel);
        this.timeline.endTimeString = this.#transformTimeToMinutes(this.timeline.endTime);
        this.#calculateTrackBarWidth();
        clearTimeout(timeoutId);
      }, 0);
    } else {
      this.timeline.endPixel = newEndPixel;
      this.#calculateTrackBarWidth();
    }
  }

  addComment() {
    this.dialog.open(CommentDialogComponent, {
      width: '350px',
      height: '300px',
    });
  }
}
