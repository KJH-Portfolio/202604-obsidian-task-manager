import { AbstractInputSuggest, App, TFolder, TFile } from "obsidian";

// 1. 폴더 경로 자동완성 클래스
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    inputEl: HTMLInputElement; // 명시적 속성 선언으로 부모 클래스 속성명 불일치 회피

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl; // 수동으로 인풋 엘리먼트 바인딩
        
        // 엔터 키 입력 시 첫 번째 제안 자동 선택 리스너 추가
        this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                const activeItem = activeDocument.querySelector(".suggestion-item.is-active");
                if (activeItem) return; // 이미 사용자가 방향키로 선택 중인 경우 기본 동작 유지

                const suggestions = this.getSuggestions(this.inputEl.value);
                if (suggestions.length > 0) {
                    this.selectSuggestion(suggestions[0]);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }

    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: TFolder[] = [];
        const lowerInputStr = inputStr.toLowerCase();

        for (const file of abstractFiles) {
            if (file instanceof TFolder) {
                // 루트 폴더('/')는 추천에서 배제하며 검색어 매칭
                if (file.path !== "/" && file.path.toLowerCase().contains(lowerInputStr)) {
                    folders.push(file);
                }
            }
        }

        // 폴더 경로명 길이 순으로 정렬하여 직관성 제공
        return folders.sort((a, b) => a.path.localeCompare(b.path));
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    selectSuggestion(folder: TFolder): void {
        this.inputEl.value = folder.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}

// 2. 파일 경로 자동완성 클래스 (마크다운 확장자 대상)
export class FileSuggest extends AbstractInputSuggest<TFile> {
    inputEl: HTMLInputElement; // 명시적 속성 선언으로 부모 클래스 속성명 불일치 회피

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl; // 수동으로 인풋 엘리먼트 바인딩

        // 엔터 키 입력 시 첫 번째 제안 자동 선택 리스너 추가
        this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                const activeItem = activeDocument.querySelector(".suggestion-item.is-active");
                if (activeItem) return; // 이미 사용자가 방향키로 선택 중인 경우 기본 동작 유지

                const suggestions = this.getSuggestions(this.inputEl.value);
                if (suggestions.length > 0) {
                    this.selectSuggestion(suggestions[0]);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
    }

    getSuggestions(inputStr: string): TFile[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const files: TFile[] = [];
        const lowerInputStr = inputStr.toLowerCase();

        for (const file of abstractFiles) {
            if (file instanceof TFile && file.extension === "md") {
                if (file.path.toLowerCase().contains(lowerInputStr)) {
                    files.push(file);
                }
            }
        }

        return files.sort((a, b) => a.path.localeCompare(b.path));
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}
