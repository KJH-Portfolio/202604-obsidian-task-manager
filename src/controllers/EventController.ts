import { App, TFile, MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
import MyWorldTaskManagerPlugin from "../main";
import { REGEX } from "../Constants";

export class EventController {
    private app: App;
    private plugin: MyWorldTaskManagerPlugin;

    constructor(app: App, plugin: MyWorldTaskManagerPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    /**
     * 워크스페이스 및 보관소 이벤트 리스너 등록
     */
    registerEvents(): void {
        // 1. 활성 탭 변경 감지
        this.plugin.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                if (leaf && leaf.view instanceof MarkdownView && leaf.view.file) {
                    const currentFile = leaf.view.file;
                    if (this.plugin.lastActiveFile && this.plugin.lastActiveFile.path !== currentFile.path) {
                        void this.plugin.triggerAutoSyncForFile(this.plugin.lastActiveFile);
                    }
                    this.plugin.lastActiveFile = currentFile;
                }
            })
        );

        // 2. 파일 수정 감지
        this.plugin.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile) {
                    this.plugin.modifiedFiles.add(file.path);
                }
            })
        );

        // 3. 라이브 프리뷰 체크박스 클릭 핸들러 등록
        this.registerCheckboxCaptureHandler();

        // 4. Tasks 플러그인 경고창 옵저버 부착
        this.attachNoticeObserver(window.document);
    }

    /**
     * CM6 Editor 및 읽기 모드 체크박스 클릭 캡처
     */
    private registerCheckboxCaptureHandler(): void {
        const checkboxCaptureHandler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target || target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") return;

            const cmEditorEl = target.closest(".cm-editor");
            if (!cmEditorEl) return;

            const leaf = this.app.workspace.getLeavesOfType("markdown").find(l => l.view.containerEl.contains(target));
            const targetFile = leaf ? (leaf.view as MarkdownView).file : null;
            if (!targetFile) return;

            const isSchedule = targetFile.path === this.plugin.settings.mainSchedulePath;
            if (!isSchedule) return;

            this.plugin.modifiedFiles.add(targetFile.path);

            // CM6 네이티브 체크박스 토글 트랜잭션이 먼저 완료된 후 동기화 수행 (트랜잭션 충돌 및 클릭 먹통 차단)
            window.setTimeout(() => {
                void this.plugin.triggerAutoSyncForFile(targetFile, true, false);
            }, 100);
        };

        this.plugin.registerDomEvent(window, "click", checkboxCaptureHandler, true);
    }

    /**
     * Tasks 플러그인 경고 메시지 억제 옵저버
     */
    private attachNoticeObserver(doc: Document): void {
        const noticeObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as HTMLElement;
                        if (el.classList.contains("notice")) {
                            const text = el.innerText || "";
                            if (text.includes("obsidian-tasks-plugin warning") && text.includes("inside a callout")) {
                                el.addClass("myworld-d-none");
                            }
                        }
                    }
                });
            });
        });
        noticeObserver.observe(doc.body, { childList: true, subtree: true });
        this.plugin.register(() => noticeObserver.disconnect());
    }
}
