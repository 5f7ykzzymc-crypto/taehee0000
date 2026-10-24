# 맞춤법 검사 구성 요소와 배포 정보

여백의 맞춤법 검사는 국립국어원이 직접 제공하는 검사 API가 아닙니다. 공개 Hunspell 엔진과 hunspell-dict-ko 한국어 사전을 브라우저에서 실행합니다. 네이버·부산대·나라인포테크 검사 서비스를 호출하거나 스크래핑하지 않습니다.

## Hunspell WebAssembly

- 배포 패키지: [hunspell-wasm 0.3.0](https://www.npmjs.com/package/hunspell-wasm/v/0.3.0)
- 원본: https://github.com/rotemdan/hunspell-wasm
- 대응 소스 커밋: `8f755ef64e8b047b77b676f9698b3dfa5cb1887d`
- 원본 소스·내장 Hunspell C++ 코드·빌드 지침: `vendor/sources/hunspell-wasm-0.3.0-source.tar.gz`
- 원 저작권자와 MPL/GPL/LGPL 선택 라이선스를 유지합니다. 전문은 `vendor/licenses/hunspell-COPYING`, `hunspell-COPYING.LESSER`, `hunspell-COPYING.MPL`에 포함했습니다.
- 여백의 변경: 원본 엔진 파일은 수정하지 않고, `tools/spellcheck-worker.js`와 `tools/build-spellcheck.mjs`로 WebAssembly를 포함한 워커 스크립트로 묶었습니다. 파일 직접 열기에서 별도 WASM 요청을 하지 않도록 WASM 바이트를 내장하고 `import.meta.url`의 미사용 파일 주소만 빌드 시 지정합니다.

## 한국어 사전

- 프로젝트: [spellcheck-ko/hunspell-dict-ko](https://github.com/spellcheck-ko/hunspell-dict-ko)
- 사전 버전: **0.7.94**, 배포 패키지 [dictionary-ko 2.0.0](https://www.npmjs.com/package/dictionary-ko/v/2.0.0)
- Copyright (C) 2008–2019 hunspell-dict-ko contributors
- Copyright (C) 2017–2019 National Institute of Korean Language (국립국어원)
- 결합 사전(`ko.aff`, `ko.dic`)의 실제 라이선스는 **GPL-3.0-or-later**입니다. npm 메타데이터의 삼중 라이선스 표시보다 파일 내 저작권·라이선스 고지를 따릅니다.
- 사전 라이선스 설명: `vendor/licenses/korean-dictionary-license.md`, GPL 전문: `vendor/licenses/LICENSE.GPL-3`.
- 대응 원본 소스·단어 데이터·생성 코드·각 데이터 라이선스·Makefile: `vendor/sources/hunspell-dict-ko-0.7.94-source.tar.gz`
- 대응 소스 태그 `0.7.94`, 커밋 `07c339220d92ce06ccbae62a345c7314a7e724ce`.
- 여백의 변경: 사전 내용 자체를 고치지 않고 gzip/base64로 포장하여 `vendor/korean-dictionary.js`로 배포합니다. 사용자가 추가한 단어는 별도 프로젝트 자료에 저장하며 원본 사전을 변경하지 않습니다.
- 사전은 엔진 및 여백 앱 코드와 구별되는 데이터 파일로 배포됩니다. 원본 저작권·라이선스 고지를 함께 보관해 주세요.

## 압축 해제 라이브러리

- [fflate 0.8.2](https://github.com/101arrowz/fflate), Copyright (c) 2023 Arjun Barrett, MIT License.
- 라이선스 전문은 `vendor/licenses/fflate-MIT.txt`에 포함했습니다.
- 원본 gzip 사전 바이트를 메모리에서 해제합니다. Safari에서 오류가 발생할 수 있는 Blob 스트림 기반 파일 읽기를 사용하지 않습니다.
- `package-lock.json`에 배포 패키지의 버전과 무결성 값이 고정되어 있습니다.

## 재현 방법

Node.js 20 이상에서 아래를 실행합니다. 앱 사용자는 빌드할 필요가 없습니다.

```sh
npm ci
npm run build
```

정확한 의존성 버전과 무결성 값은 `package-lock.json`, 사전·WASM·대응 소스 아카이브의 SHA-256은 `vendor/CHECKSUMS.json`에 있습니다. 소스 아카이브는 위 고정 커밋의 GitHub codeload에서 가져왔으며 ZIP 다운로드에 함께 포함됩니다. 사전 생성 방식은 아카이브의 README와 Makefile, Hunspell WASM 재컴파일 지침은 엔진 소스의 `docs/Building.md`와 Makefile을 참고하세요.

사전 검사는 어절·단어 활용형을 기준으로 합니다. 모든 띄어쓰기, 문법, 문맥 오류를 찾는 문장 교정 엔진과는 범위가 다릅니다.
