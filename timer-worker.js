self.onmessage = function (e) {
    if (e.data.command === 'START') {
        const endTime = e.data.endTime;

        // Clear any existing interval
        if (self.timerId) clearInterval(self.timerId);

        // Interval
        self.timerId = setInterval(() => {
            const now = Date.now();
            const diff = Math.ceil((endTime - now) / 1000);

            if (diff <= 0) {
                // Time's up
                self.postMessage({ type: 'FINISH' });
                clearInterval(self.timerId);
                self.timerId = null;
            } else {
                // Tick
                self.postMessage({ type: 'TICK', timeLeft: diff });
            }
        }, 100); // Check every 100ms

    } else if (e.data.command === 'STOP') {
        // Stop timer
        if (self.timerId) {
            clearInterval(self.timerId);
            self.timerId = null;
        }
    }
};
