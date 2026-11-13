# WHAT REMAINS 배경음악

- 곡: **Iridescent Deep — Alternate Loop**
- 작가: **Tsorthan Grove**
- 파일: `iridescent-deep-alternate-loop.ogg` (153.6초, 44.1kHz, 2,138,023바이트)
- 작가의 공개 페이지: https://opengameart.org/content/iridescent-deep
- 다운로드 원본: https://opengameart.org/sites/default/files/iridescent_deep_ogg.7z
- 원본 묶음 안의 파일명: `Iridescent Deep - Loop (Alternate).ogg`
- 공개 라이선스: **CC0 1.0 Universal**
- 라이선스 설명: https://creativecommons.org/publicdomain/zero/1.0/
- 라이선스 전문: https://creativecommons.org/publicdomain/zero/1.0/legalcode
- 출처와 라이선스 확인 / 다운로드 날짜: 2026-11-13
- SHA-256: `f18266f3f1af82b161eed598ba3d5d4f3a2f0010f00873b2477d1ce64456705c`

작가가 직접 게시한 페이지에 CC0와 저작자 표시 불필요가 명시되어 있다. 이 파일은 그 페이지에서 내려받은 원본 alternate loop이며 이름만 바꿨다. CC0 설명은 상업 목적을 포함한 복제·변형·배포·공연을 허용한다. 작가가 이 전시를 후원하거나 보증한다는 뜻은 아니다.

## 선정 방향과 재생

원작자가 더 차분하다고 설명한 alternate 버전을 골랐다. 몽환적인 공간감과 천천히 겹치는 음색이 민트 배경, 빛 번짐, 느리게 움직이는 잔상과 어울리도록 낮은 음량으로 반복한다. 파일 자체를 리믹스하거나 재생속도를 바꾸지 않는다.

운영자가 카메라와 소리를 연결한 뒤 기존 AudioContext로 시작한다. 3초 동안 서서히 커지며, 10초 체험 중에는 배경음악을 평소 음량의 30%로 줄여 카운트 소리를 들을 수 있게 한다. 체험 후 1.8초 동안 원래 음량으로 돌아온다. 배경음악을 꺼도 시작·카운트·완료 소리는 유지된다. 로컬 파일이므로 재생에 외부 서비스가 필요 없다.

선택 표시 문구: `Music: Iridescent Deep (Alternate Loop) — Tsorthan Grove · CC0 1.0`

## 모듈 연결

```js
import { ExhibitionSoundtrack, SOUNDTRACK } from './soundtrack.mjs';
// 기존 오디오 연결 버튼에서 context.resume() 성공 후:
soundtrack ??= new ExhibitionSoundtrack(audio);
void soundtrack.start(); // 실패해도 카운트다운과 체험은 계속 작동
soundtrack.setRecording(state === 'recording');
// 운영자 설정:
soundtrack.setMuted(true); // 음악만 음소거
soundtrack.setVolume(0.22); // 기본 0.22, 최대 0.6
```

`start()`는 성공 여부를 반환하고, 실패 상세는 `soundtrack.error`에 남긴다. 새 AudioContext를 만들지 않으며 오디오 권한이나 기기 상태를 임의로 바꾸지 않는다.
