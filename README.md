# IBRS

브라우저에서 실행되는 이미지 배경 제거 도구입니다.

## 기능

- 이미지 업로드 및 미리보기
- AI 방식 선택: IMG.LY 범용 / MediaPipe 인물용
- 단계별 처리 진행률 표시
- 조절 항목별 도움말 툴팁
- 추천 프리셋: 인물, 제품, 스티커/로고, 흰 글자/얇은 선
- 빠른 문제 해결 버튼: 디테일 복원, 잔여물 제거, 머리카락 보정
- 결과/비교/원본 보기
- 마스크 보기
- 지우기/복원 브러시 수동 보정
- 마스크 임계값, 가장자리 부드럽게, 확장/축소, 색 번짐 제거 조절
- 투명 배경 PNG 다운로드

## 라이선스 메모

배경 제거 엔진은 두 가지를 선택할 수 있습니다.

- IMG.LY `@imgly/background-removal`: AGPL-3.0 라이선스
- Google MediaPipe Tasks Vision: Apache-2.0 라이선스

사용자의 이미지는 브라우저에서 처리됩니다. IMG.LY 방식을 공개 서비스에서 사용할 경우 AGPL-3.0 조건을 준수하기 위해 이 저장소의 소스코드를 공개 상태로 유지해야 합니다.

## 폰트

UI 폰트는 `Noto Sans KR Hestia` 400/500/700 웹폰트를 사용합니다.

## 배포

정적 사이트입니다. Vercel에서 GitHub 저장소를 연결한 뒤 다음 설정으로 배포합니다.

- Framework Preset: Other
- Build Command: 비움
- Output Directory: `.`

`main` 브랜치에 푸시하면 Vercel Git 연동으로 자동 배포됩니다.
