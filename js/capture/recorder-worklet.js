class MotusRecorder extends AudioWorkletProcessor
{
    constructor()
    {
        super();
        this.buffer = new Float32Array(2048);
        this.filled = 0;
    }

    process(inputs)
    {
        const input = inputs[0];
        if (input && input[0])
        {
            const channel = input[0];
            for (let i = 0; i < channel.length; i++)
            {
                this.buffer[this.filled++] = channel[i];
                if (this.filled === this.buffer.length)
                {
                    this.port.postMessage(this.buffer.slice(0));
                    this.filled = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor("motus-recorder", MotusRecorder);
