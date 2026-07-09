# IBRS

브라우저에서 실행되는 이미지 배경 제거 도구입니다.

## 기능

- 이미지 업로드 및 미리보기
- MediaPipe 기반 브라우저 배경 제거
- 단계별 처리 진행률 표시
- 결과/비교/원본 보기
- 마스크 보기
- 지우기/복원 브러시 수동 보정
- 마스크 임계값, 가장자리 부드럽게, 확장/축소, 색 번짐 제거 조절
- 투명 배경 PNG 다운로드

## 라이선스 메모

배경 제거 엔진은 Google MediaPipe Tasks Vision을 사용합니다. MediaPipe는 Apache-2.0 라이선스이며, 사용자의 이미지는 브라우저에서 처리됩니다.

## 배포

정적 사이트입니다. Vercel에서 GitHub 저장소를 연결한 뒤 다음 설정으로 배포합니다.

- Framework Preset: Other
- Build Command: 비움
- Output Directory: `.`

`main` 브랜치에 푸시하면 Vercel Git 연동으로 자동 배포됩니다.
