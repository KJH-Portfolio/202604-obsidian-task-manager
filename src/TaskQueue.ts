export class TaskQueue {
    private queue: Array<() => Promise<void>> = [];
    private isProcessing = false;
    private debounceTimers: Map<string, number> = new Map();

    /**
     * 특정 키(key)에 대해 300ms 디바운싱 후 순차적(직렬화) 큐에 등록하여 실행.
     * 연속 클릭 시 이전 미실행 요청은 취소되고 300ms 후 최신 1회만 직렬 처리됨.
     */
    enqueue(key: string, task: () => Promise<void>, debounceMs = 300): void {
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        const timer: number = window.setTimeout(() => {
            this.debounceTimers.delete(key);
            this.queue.push(task);
            void this.processQueue();
        }, debounceMs);

        this.debounceTimers.set(key, timer);
    }

    /**
     * 큐에 쌓인 비동기 작업을 한 번에 1개씩 순서대로(Sequential) 안전하게 실행.
     * while 루프와 try...finally를 적용하여 데드락 및 재귀 스택 누수를 원천 차단.
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.queue.length > 0) {
                const currentTask = this.queue.shift();
                if (currentTask) {
                    try {
                        await currentTask();
                    } catch (err) {
                        console.error("[TaskQueue] Failed to process queued task:", err);
                    }
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 대기 중인 모든 타이머 및 큐 초기화 (플러그인 unload 시 정돈)
     */
    clear(): void {
        for (const timer of this.debounceTimers.values()) {
            window.clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.queue = [];
        this.isProcessing = false;
    }
}
