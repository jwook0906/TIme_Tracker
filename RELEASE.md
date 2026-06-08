# 릴리즈 / 자동 업데이트 설정 가이드

자동 업데이트는 GitHub Releases에 게시된 `latest.json`과 서명된 설치 파일을 앱이 주기적으로 확인하는 방식으로 동작합니다. 아래는 **최초 1회 설정**과 **버전을 새로 배포할 때마다** 해야 할 작업입니다.

## 1. 최초 1회 설정

### 1) GitHub 저장소 준비
이 프로젝트를 GitHub 저장소로 푸시합니다 (현재는 git 저장소가 아님).

```
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git push -u origin main
```

### 2) 업데이트 서명 키 생성
아래 명령을 **본인 터미널에서 직접** 실행하세요 (비밀번호를 입력하라는 프롬프트가 나타납니다 — 이 비밀번호와 개인키는 외부에 노출되면 안 되므로 직접 입력해야 합니다).

```
npm run tauri signer generate -- -w "%USERPROFILE%\.tauri\time-tracker-updater.key"
```

실행하면:
- 개인키 파일이 지정한 경로(`~/.tauri/time-tracker-updater.key`)에 생성됩니다.
- 콘솔에 **공개키(public key)** 문자열이 출력됩니다.

### 3) 공개키를 설정 파일에 반영
출력된 공개키를 `src-tauri/tauri.conf.json`의 `plugins.updater.pubkey` 값(`<TAURI_UPDATER_PUBKEY>` 자리)에 붙여넣습니다.

또한 같은 파일의 `plugins.updater.endpoints`에 있는 `<GITHUB_USER>/<GITHUB_REPO>`를 실제 GitHub 사용자명/저장소명으로 교체합니다.

### 4) GitHub Secrets 등록
GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**에서 아래 두 개를 등록합니다.

| 이름 | 값 |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | 2)에서 생성된 개인키 파일의 **내용 전체** |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 2)에서 입력한 비밀번호 |

`.github/workflows/release.yml`이 이 두 시크릿을 사용해 빌드된 설치 파일과 업데이트 아티팩트에 서명합니다.

### 5) INSTALL.md 링크 확인
`INSTALL.md`의 GitHub Releases 링크 placeholder를 실제 저장소 주소로 교체합니다.

## 2. 새 버전을 배포할 때마다

1. `src-tauri/tauri.conf.json`의 `version`과 `src-tauri/Cargo.toml`의 `version`을 새 버전으로 올립니다 (둘이 일치해야 함).
2. 변경 사항을 커밋합니다.
3. 버전 태그를 만들어 푸시합니다.

```
git add -A
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
git push origin main --tags
```

4. 태그 푸시를 감지한 GitHub Actions(`release.yml`)가 자동으로 빌드 → 서명 → GitHub Release(초안) 생성까지 진행합니다.
5. GitHub 저장소의 **Releases** 탭에서 초안(draft)을 확인하고, 릴리즈 노트(`releaseBody`의 "변경 사항" 부분)를 보완한 뒤 **Publish release**를 누릅니다.
6. 게시되는 즉시 기존 사용자의 앱이 다음 자동 확인 시 새 버전을 감지하고 업데이트를 안내합니다.

> 주의: `releaseDraft: true`로 설정되어 있어 자동으로는 "초안"까지만 만들어집니다. 실수로 미완성 버전이 사용자에게 바로 배포되는 것을 막기 위함이며, 최종 게시는 직접 확인 후 수동으로 진행하세요.
