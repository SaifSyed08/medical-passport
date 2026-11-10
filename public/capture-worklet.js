// Collects mono mic samples into ~20 ms frames and posts them to the main thread.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = Math.round(sampleRate / 50);
    this.buf = new Float32Array(this.frame);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.frame) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(this.frame);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
