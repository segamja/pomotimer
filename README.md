# 포모도로 타이머

집중 타이머와 할일 목록을 한 화면에서 사용할 수 있는 웹앱입니다.

## 기능

- 포모도로 타이머 (25분 집중 / 5분 휴식 / 15분 긴 휴식)
- 직접 시간 설정
- 할일 추가, 완료, 삭제, 필터
- 접속 시 랜덤 시간 명언 표시
- localStorage로 데이터 자동 저장

## 실행 방법

### 1. GitHub Pages (온라인)

배포 후 아래 주소에서 바로 실행할 수 있습니다.

**https://segamja.github.io/pomotimer/**

### 2. 로컬에서 실행

빌드 없이 HTML 파일을 브라우저에서 열면 됩니다.

```bash
# 방법 A: index.html 더블클릭

# 방법 B: Python 간이 서버
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속

# 방법 C: npx
npx serve .
```

## 파일 구조

```
pomotimer/
├── index.html   # 메인 페이지
├── styles.css   # 스타일
├── app.js       # 타이머 & 할일 로직
└── README.md
```

## 기술 스택

- HTML / CSS / JavaScript (Vanilla)
- localStorage
- GitHub Pages
