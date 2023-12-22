class App {
	constructor(container) {
		this.container = container;
		this.initApp();
	}

	initApp() {

		const controlbar = document.createElement('div');
		controlbar.classList.add('control-bar');
		controlbar.innerHTML = `
			<label class='file-open'>
				Load local file
				<input type='file' id='fileInput' accept='video/*' />
			</label>
			<form class='url-open'>
				<input type='text' id='urlInput' placeholder='https://video-url-to-load' value='https://i.giphy.com/FLhbB86a5nLXy.mp4' />
				<button type='submit'>Load</button>
			</form>
			<label>
				Brightness
				<input type='range' id='brightSlider' min='0' max='1' step='any' />
			</label>
		`;

		this.fileInput = controlbar.querySelector('#fileInput');
		this.fileInput.addEventListener('change', this.openFileHandler.bind(this));

		this.urlInput = controlbar.querySelector('#urlInput');
		this.urlForm = controlbar.querySelector('form.url-open');
		this.urlForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const url = this.urlInput.value.trim();
			this.openUrl(url);
		});

		this.brightBlur = 0.12;
		this.brightBlurSlide = controlbar.querySelector('#brightSlider');
		this.brightBlurSlide.value = this.brightBlur;
		this.brightBlurSlide.addEventListener('input', (e) => {
			this.brightBlur = Number(this.brightBlurSlide.value) || 0;
		});

		this.buffer = document.createElement('canvas');
		this.bufferCtx = this.buffer.getContext('2d');
		this.canvas = document.createElement('canvas');

		this.scanline = new Scanline(this.canvas);

		this.container.innerHTML = '';
		this.container.appendChild(controlbar);
		this.container.appendChild(this.canvas);

		this.callbackTimer = null;

		this.scanline = new Scanline(this.canvas);
	}

	openFileHandler(e) {
		if (!this.fileInput.files || !this.fileInput.files[0]) return;

		const objectUrl = URL.createObjectURL(this.fileInput.files[0]);
		this.openUrl(objectUrl);
	}

	openUrl(url) {
		if (!this.video) {
			this.video = document.createElement('video');
			this.video.crossOrigin = 'anonymous';
			this.video.addEventListener('playing', () => {
				const ratio = this.video.videoHeight / this.video.videoWidth;
				this.buffer.width = Math.min(this.video.videoWidth, ((window.innerWidth - 20) / 3) | 0);
				this.buffer.height = this.buffer.width * ratio;
				this.canvas.width = this.buffer.width * 3;
				this.canvas.height = this.buffer.height * 3;
				if (!this.callbackTimer) { 
					this.timerCallback();
				}
			});
		} else {
			this.video.pause();
		}

		this.video.src = url;
		this.video.volume = 0.1;
		this.video.loop = true;
		this.video.play();
	}

	timerCallback() {
		if (this.video.paused || this.video.ended ) {
			this.callbackTimer = false;
			return;
		}

		this.callbackTimer = true;
		this.computeFrame();

		requestAnimationFrame(() => {
			this.timerCallback();
		});
	}

	computeFrame() {
		this.bufferCtx.drawImage(this.video, 0, 0, this.buffer.width, this.buffer.height);
		this.scanline.render(this.buffer, { brightBlur: this.brightBlur });
	}
}

const app = new App(document.getElementById('app'));
