# game-tetris

HTML/CSS/JavaScript로 만든 테트리스 게임입니다.  
PC 키보드 조작과 모바일 터치 조작을 모두 지원합니다.

## 실행 방법

1. `game-tetris` 폴더에서 `index.html`을 브라우저로 엽니다.
2. `Start` 버튼으로 게임을 시작합니다.
3. 모바일 브라우저에서는 하단 터치 버튼으로 플레이할 수 있습니다.

## PC 조작

- `←` / `→`: 좌우 이동
- `↓`: 빠른 하강
- `↑`: 회전
- `Space`: 즉시 떨어뜨리기
- `C` 또는 `Shift`: Hold
- `P`: 일시정지 / 재개
- `R`: 재시작

## 모바일 조작

하단 터치 버튼:

- `LEFT`, `RIGHT`, `DOWN`
- `ROT` (회전)
- `DROP` (즉시 떨어뜨리기)
- `HOLD`
- `PAUSE`
- `RESET`

## 주요 기능

- 10x20 보드, 7종 블록
- Hold / Next 미리보기
- 점수 / 레벨 / 콤보
- Double / Triple / Tetris / Combo 팝업 효과
- Web Audio API 기반 효과음 / 배경음악
- 사운드 설정(SFX/BGM/볼륨) 및 localStorage 저장
- PC/모바일 반응형 UI
