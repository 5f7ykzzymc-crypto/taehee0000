const initial = [
  {
    title: "여름의 끝에서",
    subtitle: "돌아오지 않을 줄 알았던 여름이, 다시 우리를 찾아왔다.",
    scenes: [
      {
        title: "오래된 정류장",
        text: "늦여름의 오후. 햇빛이 기울어진 버스 정류장.\n낡은 시간표 위로 나뭇잎 그림자가 느리게 흔들린다.\n\n서연은 정류장 끝에 앉아, 녹아내리는 아이스크림을 바라본다.\n손끝으로 흘러내리는 바닐라. 닦아낼 생각은 없어 보인다.\n\n서연 (내레이션)\n“어떤 여름은 끝나지 않는다.\n 그저, 우리가 잊은 척하고 있을 뿐.”\n\n멀리서 버스 한 대가 다가온다.\n서연은 고개를 들지 않는다. 늘 타던 버스가 아니니까.\n\n그때, 익숙한 목소리.\n\n도윤\n“아직도 바닐라만 먹네.”\n\n서연의 손이 멈춘다.\n매미 소리가, 잠깐 멀어진다.",
      },
      {
        title: "뜻밖의 재회",
        text: "버스 문이 닫히고, 두 사람 사이로 바람이 지나간다.\n\n서연\n“너… 언제 왔어?”",
      },
      {
        title: "말하지 못한 이야기",
        text: "해가 지기 시작했다.\n둘은 한동안 아무 말 없이 걸었다.",
      },
    ],
  },
  {
    title: "다시 만난 계절",
    subtitle: "익숙한 골목에서 발견한 낯선 마음.",
    scenes: [
      { title: "골목길", text: "비가 그친 골목. 익숙한 발소리가 들린다." },
    ],
  },
  {
    title: "우리 사이의 온도",
    subtitle: "조금씩 가까워지는 두 사람의 이야기.",
    scenes: [
      { title: "작은 카페", text: "창가에 놓인 두 잔의 커피.\n아직 따뜻하다." },
    ],
  },
];

("use strict");
const STORAGE_KEY = "yeobaek-project-v2";
const $ = (id) => document.getElementById(id);
const icons = {
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z",
  pen: "m16 3 5 5-12 12-6 1 1-6z M14 5l5 5",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  focus: "M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5",
  plus: "M12 5v14 M5 12h14",
  moon: "M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10",
  export: "M12 16V3 M7 8l5-5 5 5 M4 14v7h16v-7",
  image: "M3 3h18v18H3z M3 16l5-5 5 5 3-3 5 5 M16 8h.01",
  checkText: "M3 4h14 M3 9h10 M3 14h6 M13 17l3 3 6-7",
  close: "M6 6l12 12 M6 18 18 6",
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", icons[name] || icons.book);
  svg.append(path);
  return svg;
}
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => el.append(icon(el.dataset.icon)));
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4200);
}
const uid = () =>
  "c-" +
  Date.now().toString(36) +
  "-" +
  Math.random().toString(36).slice(2, 10);
const fields = [
  "name",
  "tagline",
  "role",
  "age",
  "appearance",
  "personality",
  "backstory",
  "motivation",
  "relationships",
  "notes",
];
const fieldIds = Object.fromEntries(
  fields.map((field) => [
    field,
    "character" + field[0].toUpperCase() + field.slice(1),
  ]),
);
function normalizeImages(images) {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > 6)
    throw new Error("이미지 목록 형식이 올바르지 않습니다.");
  return images.map((image) => {
    if (
      !image ||
      typeof image.data !== "string" ||
      !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
        image.data,
      ) ||
      image.data.length > 2000000
    )
      throw new Error("지원하지 않는 이미지가 포함되어 있습니다.");
    return {
      data: image.data,
      name:
        typeof image.name === "string"
          ? image.name.slice(0, 200)
          : "참고 이미지",
    };
  });
}
function normalizeEpisodes(data) {
  if (!Array.isArray(data) || !data.length || data.length > 500)
    throw new Error("에피소드 데이터가 올바르지 않습니다.");
  return data.map((episode) => {
    if (
      !episode ||
      typeof episode.title !== "string" ||
      !Array.isArray(episode.scenes) ||
      !episode.scenes.length ||
      episode.scenes.length > 1000
    )
      throw new Error("에피소드 형식이 올바르지 않습니다.");
    return {
      title: episode.title,
      subtitle: typeof episode.subtitle === "string" ? episode.subtitle : "",
      scenes: episode.scenes.map((s) => {
        if (!s || typeof s.title !== "string" || typeof s.text !== "string")
          throw new Error("장면 형식이 올바르지 않습니다.");
        return {
          title: s.title,
          text: s.text,
          images: normalizeImages(s.images),
        };
      }),
    };
  });
}
function normalizeProject(data) {
  if (
    !data ||
    data.version !== 2 ||
    !Array.isArray(data.characters) ||
    data.characters.length > 500
  )
    throw new Error("여백 백업 파일을 선택해 주세요.");
  const ids = new Set();
  return {
    version: 2,
    episodes: normalizeEpisodes(data.episodes),
    characters: data.characters.map((character) => {
      if (!character || fields.some((f) => typeof character[f] !== "string"))
        throw new Error("캐릭터 형식이 올바르지 않습니다.");
      const id =
        typeof character.id === "string" && !ids.has(character.id)
          ? character.id
          : uid();
      ids.add(id);
      return Object.assign(
        { id, images: normalizeImages(character.images) },
        Object.fromEntries(fields.map((f) => [f, character[f]])),
      );
    }),
  };
}
let project = {
  version: 2,
  episodes: normalizeEpisodes(initial),
  characters: [],
};
let loadProblem = "",
  unreadableRaw = null;
const RECOVERY_KEY = "yeobaek-recovery-v2";
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      project = normalizeProject(JSON.parse(saved));
    } catch (error) {
      unreadableRaw = saved;
      throw error;
    }
  } else {
    const legacy = localStorage.getItem("yeobaek-v1");
    if (legacy) project.episodes = normalizeEpisodes(JSON.parse(legacy));
  }
} catch (error) {
  loadProblem =
    "저장된 자료를 읽지 못했습니다. 백업 파일이 있다면 불러와 주세요.";
}
let view = "writing",
  ep = 0,
  scene = 0,
  characterIndex = 0,
  font = 16,
  review = null,
  generation = 0;
let hasStorageError = false,
  imageBusy = false;
try {
  const settings = JSON.parse(localStorage.getItem("yeobaek-ui") || "{}");
  document.body.classList.toggle("dark", settings.dark === true);
  if ([16, 18, 20, 22].includes(settings.font)) font = settings.font;
} catch {}
function saveSettings() {
  try {
    localStorage.setItem(
      "yeobaek-ui",
      JSON.stringify({ dark: document.body.classList.contains("dark"), font }),
    );
  } catch {}
}
function persist(notify = true) {
  try {
    if (unreadableRaw !== null) {
      const existing = localStorage.getItem(RECOVERY_KEY);
      if (existing !== null && existing !== unreadableRaw)
        throw new Error("복구 자료를 먼저 내려받아 주세요.");
      localStorage.setItem(RECOVERY_KEY, unreadableRaw);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    unreadableRaw = null;
    hasStorageError = false;
    $("saved").textContent = "✓ 저장됨";
    return true;
  } catch (error) {
    hasStorageError = true;
    $("saved").textContent = "저장되지 않음";
    if (notify)
      toast(
        "브라우저 저장 공간을 사용할 수 없습니다. 전체 백업으로 원고를 보관해 주세요.",
      );
    return false;
  }
}
function currentScene() {
  return project.episodes[ep].scenes[scene];
}
function currentCharacter() {
  return project.characters[characterIndex];
}
function counts() {
  if (view === "characters") {
    $("count").textContent = project.characters.length + "명의 캐릭터";
    $("reading").textContent = currentCharacter()?.name || "인물 설정";
    $("fontSize").hidden = true;
  } else {
    const n = [...$("editor").value.replace(/\s/g, "")].length;
    $("count").textContent = n.toLocaleString() + "자 (공백 제외)";
    $("reading").textContent =
      "약 " + Math.max(1, Math.ceil(n / 450)) + "분 읽기";
    $("fontSize").hidden = false;
    $("editor").style.height = "auto";
    $("editor").style.height = $("editor").scrollHeight + "px";
  }
}
function renderItems() {
  $("items").replaceChildren();
  const entries = view === "writing" ? project.episodes : project.characters;
  entries.forEach((entry, index) => {
    const selected = index === (view === "writing" ? ep : characterIndex);
    const button = element("button", "item" + (selected ? " current" : ""));
    button.setAttribute("aria-current", selected ? "true" : "false");
    if (view === "writing")
      button.append(
        element("span", "item-index", String(index + 1).padStart(2, "0")),
      );
    else {
      const avatar = element("span", "item-avatar");
      if (entry.images.length) {
        const img = element("img");
        img.src = entry.images[0].data;
        img.alt = "";
        avatar.append(img);
      } else avatar.textContent = entry.name.trim().slice(0, 1) || "인";
      button.append(avatar);
    }
    const content = element("div", "item-content");
    content.append(
      element(
        "strong",
        "",
        (view === "writing" ? entry.title : entry.name) || "제목 없음",
      ),
    );
    content.append(
      element(
        "small",
        "",
        view === "writing"
          ? entry.scenes.length + "개의 장면"
          : entry.role || "역할 미설정",
      ),
    );
    button.append(content);
    button.onclick = () => {
      if (view === "writing") {
        ep = index;
        scene = 0;
      } else characterIndex = index;
      render();
      $("documentScroll").scrollTop = 0;
    };
    $("items").append(button);
  });
  if (!entries.length)
    $("items").append(
      element(
        "p",
        "empty-list",
        "새 캐릭터를 추가하고 인물의 이야기를 기록해 보세요.",
      ),
    );
  $("total").textContent = project.episodes.length;
  $("characterTotal").textContent = project.characters.length;
}
function renderScenes() {
  $("scenes").replaceChildren();
  project.episodes[ep].scenes.forEach((entry, index) => {
    const button = element(
      "button",
      "scene" + (index === scene ? " current" : ""),
    );
    button.setAttribute("aria-current", index === scene ? "true" : "false");
    button.append(
      element("small", "", "SCENE " + String(index + 1).padStart(2, "0")),
      element("strong", "", entry.title || "장면 제목"),
      element("p", "", entry.text.slice(0, 45) || "아직 쓰지 않은 이야기"),
    );
    button.onclick = () => {
      scene = index;
      render();
      $("documentScroll").scrollTop = 0;
    };
    $("scenes").append(button);
  });
  $("sceneCount").textContent =
    project.episodes[ep].scenes.length + "개의 장면";
}
function renderImages(kind) {
  const target = kind === "character" ? currentCharacter() : currentScene();
  const container = $(kind === "character" ? "characterImages" : "sceneImages");
  container.replaceChildren();
  const images = target?.images || [];
  images.forEach((image, index) => {
    const figure = element("figure", "image-card");
    const open = element("button", "image-open");
    open.setAttribute("aria-label", image.name + " 크게 보기");
    const img = element("img");
    img.src = image.data;
    img.alt = image.name;
    img.loading = "lazy";
    open.append(img);
    open.onclick = () => {
      $("largeImage").src = image.data;
      $("largeImage").alt = image.name;
      $("imageDialog").showModal();
    };
    const remove = element("button", "image-delete");
    remove.append(icon("close"));
    remove.setAttribute("aria-label", image.name + " 삭제");
    remove.onclick = async () => {
      if (
        !(await confirmAction(
          "이미지 삭제",
          "이 참고 이미지를 삭제할까요?",
          "삭제",
        ))
      )
        return;
      const previous = target.images;
      target.images = previous.filter((_, i) => i !== index);
      if (!persist()) {
        target.images = previous;
        return;
      }
      renderImages(kind);
      renderItems();
    };
    figure.append(open, remove, element("figcaption", "", image.name));
    container.append(figure);
  });
  $(
    kind === "character" ? "characterImageCount" : "sceneImageCount",
  ).textContent = kind === "character" ? images.length + " / 6" : images.length;
  const zone = $(kind === "character" ? "characterDropzone" : "sceneDropzone");
  zone.hidden = images.length >= 6;
}
function render() {
  const isWriting = view === "writing";
  $("writingView").hidden = !isWriting;
  $("characterView").hidden = isWriting;
  $("outline").hidden = !isWriting;
  $("focus").hidden = !isWriting;
  $("focusNav").hidden = !isWriting;
  $("fontSize").textContent = "가 " + font;
  $("editor").style.fontSize = font + "px";
  $("theme").setAttribute(
    "aria-pressed",
    document.body.classList.contains("dark"),
  );
  ["writing", "characters"].forEach((key) => {
    $(key + "Nav").classList.toggle("active", view === key);
    if (view === key) $(key + "Nav").setAttribute("aria-current", "page");
    else $(key + "Nav").removeAttribute("aria-current");
  });
  $("listLabel").textContent = isWriting ? "에피소드" : "등장인물";
  $("add").setAttribute(
    "aria-label",
    isWriting ? "에피소드 추가" : "캐릭터 추가",
  );
  $("categoryCrumb").textContent = isWriting ? "글쓰기" : "캐릭터 시트";
  $("footerMessage").textContent = isWriting
    ? "모든 이야기는 한 문장에서 시작됩니다."
    : "입체적인 인물이 이야기를 움직입니다.";
  renderItems();
  if (isWriting) {
    const entry = project.episodes[ep];
    $("title").value = entry.title;
    $("subtitle").value = entry.subtitle;
    $("crumb").textContent = entry.title;
    $("epnum").textContent = String(ep + 1).padStart(2, "0");
    $("sceneNumber").textContent =
      "SCENE " + String(scene + 1).padStart(2, "0");
    $("sceneTitle").value = currentScene().title;
    $("editor").value = currentScene().text;
    renderScenes();
    renderImages("scene");
  } else {
    const character = currentCharacter();
    $("characterEmpty").hidden = !!character;
    $("characterSheet").hidden = !character;
    $("crumb").textContent = character?.name || "등장인물";
    if (character) {
      fields.forEach((field) => ($(fieldIds[field]).value = character[field]));
      renderImages("character");
    }
  }
  counts();
}
function switchView(next) {
  view = next;
  document.body.classList.remove("focus");
  updateFocusButton();
  render();
  $("documentScroll").scrollTop = 0;
}
$("writingNav").onclick = () => switchView("writing");
$("charactersNav").onclick = () => switchView("characters");
$("editor").oninput = () => {
  currentScene().text = $("editor").value;
  persist();
  counts();
  renderScenes();
};
$("title").oninput = () => {
  project.episodes[ep].title = $("title").value;
  $("crumb").textContent = $("title").value;
  persist();
  renderItems();
};
$("subtitle").oninput = () => {
  project.episodes[ep].subtitle = $("subtitle").value;
  persist();
};
$("sceneTitle").oninput = () => {
  currentScene().title = $("sceneTitle").value;
  persist();
  renderScenes();
};
fields.forEach(
  (field) =>
    ($(fieldIds[field]).oninput = () => {
      if (!currentCharacter()) return;
      currentCharacter()[field] = $(fieldIds[field]).value;
      persist();
      if (field === "name" || field === "role") {
        renderItems();
        $("crumb").textContent = currentCharacter().name;
        counts();
      }
    }),
);
function addCharacter() {
  const character = { id: uid(), images: [] };
  fields.forEach((field) => (character[field] = ""));
  character.name = "새 캐릭터";
  project.characters.push(character);
  characterIndex = project.characters.length - 1;
  persist();
  switchView("characters");
  $("characterName").focus();
  $("characterName").select();
}
$("newCharacter").onclick = addCharacter;
$("createFirstCharacter").onclick = addCharacter;
$("add").onclick = () => {
  if (view === "characters") return addCharacter();
  project.episodes.push({
    title: "새로운 에피소드",
    subtitle: "",
    scenes: [{ title: "첫 번째 장면", text: "", images: [] }],
  });
  ep = project.episodes.length - 1;
  scene = 0;
  persist();
  render();
  $("documentScroll").scrollTop = 0;
  $("title").focus();
  $("title").select();
};
$("addScene").onclick = () => {
  project.episodes[ep].scenes.push({
    title: "새로운 장면",
    text: "",
    images: [],
  });
  scene = project.episodes[ep].scenes.length - 1;
  persist();
  render();
  $("documentScroll").scrollTop = 0;
  $("sceneTitle").focus();
  $("sceneTitle").select();
};
$("deleteCharacter").onclick = async () => {
  const character = currentCharacter();
  if (
    !character ||
    !(await confirmAction(
      "캐릭터 삭제",
      `‘${character.name || "이름 없는 캐릭터"}’의 설정과 참고 이미지를 삭제할까요?\n필요한 자료는 먼저 전체 백업으로 보관해 주세요.`,
      "삭제",
    ))
  )
    return;
  const previous = project.characters;
  project.characters = previous.filter((c) => c !== character);
  if (!persist()) {
    project.characters = previous;
    return;
  }
  characterIndex = Math.min(
    characterIndex,
    Math.max(0, project.characters.length - 1),
  );
  render();
  toast("캐릭터 시트를 삭제했습니다.");
};
function updateFocusButton() {
  const active = document.body.classList.contains("focus");
  $("focus").setAttribute("aria-pressed", active);
  $("focus").querySelector(".tool-label").textContent = active
    ? "집중 종료"
    : "집중 모드";
}
function toggleFocus() {
  document.body.classList.toggle("focus");
  updateFocusButton();
  counts();
}
$("focus").onclick = toggleFocus;
$("focusNav").onclick = toggleFocus;
$("theme").onclick = () => {
  document.body.classList.toggle("dark");
  $("theme").setAttribute(
    "aria-pressed",
    document.body.classList.contains("dark"),
  );
  saveSettings();
};
$("fontSize").onclick = () => {
  font = font === 22 ? 16 : font + 2;
  $("editor").style.fontSize = font + "px";
  $("fontSize").textContent = "가 " + font;
  saveSettings();
  counts();
};
window.addEventListener("resize", counts);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    document.body.classList.contains("focus") &&
    !document.querySelector("dialog[open]")
  )
    toggleFocus();
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    if (persist()) toast("이 브라우저에 저장했습니다.");
  }
});
window.addEventListener("beforeunload", (event) => {
  if (hasStorageError) {
    event.preventDefault();
    event.returnValue = "";
  }
});
document.querySelectorAll(".format").forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll(".format")
        .forEach((b) => b.classList.toggle("selected", b === button));
      if (button.dataset.insert) {
        const editor = $("editor");
        editor.setRangeText(
          button.dataset.insert.replace(/\\n/g, "\n"),
          editor.selectionStart,
          editor.selectionEnd,
          "end",
        );
        editor.dispatchEvent(new Event("input"));
        editor.focus();
      }
    }),
);
function download(contents, type, name) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = element("a");
  a.href = url;
  a.download = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function imageMarkdown(images) {
  return images
    .map(
      (image) =>
        "![" + image.name.replace(/[\[\]\r\n]/g, "") + "](" + image.data + ")",
    )
    .join("\n\n");
}
$("export").onclick = () => {
  if (view === "writing") {
    const entry = project.episodes[ep];
    download(
      "# " +
        entry.title +
        "\n\n" +
        entry.subtitle +
        "\n\n" +
        entry.scenes
          .map(
            (s, i) =>
              "## " +
              (i + 1) +
              ". " +
              s.title +
              "\n\n" +
              s.text +
              (s.images.length
                ? "\n\n### 참고 이미지\n\n" + imageMarkdown(s.images)
                : ""),
          )
          .join("\n\n"),
      "text/markdown;charset=utf-8",
      (entry.title || "에피소드") + ".md",
    );
  } else {
    const character = currentCharacter();
    if (!character) return toast("먼저 캐릭터 시트를 만들어 주세요.");
    const labels = [
      "이름",
      "한 줄 소개",
      "극 중 역할",
      "나이 / 직업",
      "외모와 특징",
      "성격과 말투",
      "배경과 과거",
      "욕망과 갈등",
      "인물 관계",
      "작가의 메모",
    ];
    const text =
      "# " +
      character.name +
      "\n\n" +
      fields
        .slice(1)
        .map((f, i) => "## " + labels[i + 1] + "\n\n" + character[f])
        .join("\n\n") +
      "\n\n## 참고 이미지\n\n" +
      imageMarkdown(character.images);
    download(
      text,
      "text/markdown;charset=utf-8",
      (character.name || "캐릭터") + "-캐릭터시트.md",
    );
  }
  toast("이미지를 포함한 Markdown 파일로 내보냈습니다.");
};
$("recoverData").onclick = () => {
  const raw = unreadableRaw || localStorage.getItem(RECOVERY_KEY);
  if (raw) download(raw, "application/json", "여백-이전저장자료-복구용.json");
};
try {
  $("recoverData").hidden =
    unreadableRaw === null && !localStorage.getItem(RECOVERY_KEY);
} catch {}
$("backup").onclick = () => {
  download(
    JSON.stringify(project, null, 2),
    "application/json",
    "여백-전체백업-" + new Date().toISOString().slice(0, 10) + ".json",
  );
  toast("원고와 캐릭터, 이미지를 함께 백업했습니다.");
};
$("restore").onclick = () => $("restoreFile").click();
$("restoreFile").onchange = async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 15000000)
      throw new Error("백업 파일은 15MB 이하로 선택해 주세요.");
    const next = normalizeProject(JSON.parse(await file.text()));
    if (
      !(await confirmAction(
        "백업 불러오기",
        `에피소드 ${next.episodes.length}개와 캐릭터 ${next.characters.length}명을 불러옵니다.\n현재 작업을 이 백업으로 교체합니다. 현재 자료는 먼저 전체 백업으로 보관해 주세요.`,
        "불러오기",
      ))
    )
      return;
    const previous = project;
    project = next;
    if (!persist()) {
      project = previous;
      return;
    }
    generation++;
    ep = 0;
    scene = 0;
    characterIndex = 0;
    switchView("writing");
    toast("백업에서 원고와 캐릭터 시트를 복원했습니다.");
  } catch (error) {
    toast(
      error instanceof SyntaxError
        ? "올바른 JSON 백업 파일을 선택해 주세요."
        : error.message,
    );
  }
};
let pendingConfirm = null;
function confirmAction(title, message, action = "확인") {
  if (pendingConfirm) return Promise.resolve(false);
  $("confirmTitle").textContent = title;
  $("confirmMessage").textContent = message;
  $("confirmAction").textContent = action;
  $("confirmDialog").showModal();
  $("confirmCancel").focus();
  return new Promise((resolve) => (pendingConfirm = resolve));
}
function resolveConfirm(value) {
  const resolve = pendingConfirm;
  pendingConfirm = null;
  $("confirmDialog").close();
  resolve?.(value);
}
$("confirmCancel").onclick = () => resolveConfirm(false);
$("confirmAction").onclick = () => resolveConfirm(true);
$("confirmDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  resolveConfirm(false);
});
$("closeImage").onclick = () => $("imageDialog").close();
$("imageDialog").addEventListener("close", () =>
  $("largeImage").removeAttribute("src"),
);

async function resizeImage(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
    throw new Error("PNG, JPG, WebP, GIF 이미지를 선택해 주세요.");
  if (file.size > 20000000)
    throw new Error("이미지 한 장은 20MB 이하로 선택해 주세요.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () =>
        reject(
          new Error("이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요."),
        );
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("이미지를 읽을 수 없습니다.");
    const scale = Math.min(
      1,
      1200 / image.naturalWidth,
      1200 / image.naturalHeight,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL("image/webp", 0.8);
    if (data.length > 1500000) data = canvas.toDataURL("image/webp", 0.55);
    if (data.length > 2000000)
      throw new Error("이미지를 더 작은 크기로 줄인 뒤 추가해 주세요.");
    return { data, name: file.name || "붙여넣은 이미지" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function addImages(files, kind) {
  const target = kind === "character" ? currentCharacter() : currentScene();
  if (!target) return toast("먼저 캐릭터 시트를 만들어 주세요.");
  if (imageBusy)
    return toast("이미지를 처리하고 있습니다. 잠시 후 다시 추가해 주세요.");
  const selected = Array.from(files);
  if (!selected.length) return;
  if (target.images.length + selected.length > 6)
    return toast(
      "참고 이미지는 시트 또는 장면마다 최대 6장까지 넣을 수 있습니다.",
    );
  imageBusy = true;
  const savedGeneration = generation;
  try {
    const images = [];
    for (const file of selected) images.push(await resizeImage(file));
    const targetStillExists =
      kind === "character"
        ? project.characters.includes(target)
        : project.episodes.some((e) => e.scenes.includes(target));
    if (savedGeneration !== generation || !targetStillExists) return;
    const previous = target.images;
    target.images = [...previous, ...images];
    if (!persist()) {
      target.images = previous;
      return;
    }
    if (
      (kind === "character" && target === currentCharacter()) ||
      (kind === "scene" && target === currentScene())
    )
      renderImages(kind);
    renderItems();
    toast(images.length + "장의 이미지를 추가했습니다.");
  } catch (error) {
    toast(error.message);
  } finally {
    imageBusy = false;
  }
}
["scene", "character"].forEach((kind) => {
  const input = $(kind + "ImageInput"),
    zone = $(kind + "Dropzone");
  input.onchange = (event) => {
    addImages(event.target.files, kind);
    input.value = "";
  };
  zone.onclick = () => input.click();
  zone.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  };
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    addImages(event.dataTransfer.files, kind);
  });
});
document.addEventListener("paste", (event) => {
  if (document.querySelector("dialog[open]")) return;
  const images = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (images.length) {
    event.preventDefault();
    addImages(images, view === "characters" ? "character" : "scene");
  }
});

$("proofread").onclick = () => {
  review = {
    target: currentScene(),
    original: currentScene().text,
    lastApplied: null,
  };
  renderReview();
  $("proofreadDialog").showModal();
};
$("closeReview").onclick = () => $("proofreadDialog").close();
$("proofreadDialog").addEventListener("close", () => (review = null));
function applyCorrections(issues) {
  if (!review) return;
  const before = review.target.text;
  if (
    issues.some(
      (issue) => before.slice(issue.start, issue.end) !== issue.original,
    )
  ) {
    renderReview();
    return toast("원고가 변경되어 검수 결과를 갱신했습니다.");
  }
  let after = before;
  [...issues]
    .sort((a, b) => b.start - a.start)
    .forEach(
      (issue) =>
        (after =
          after.slice(0, issue.start) +
          issue.replacement +
          after.slice(issue.end)),
    );
  review.target.text = after;
  review.lastApplied = { before, after };
  persist();
  $("editor").value = after;
  counts();
  renderScenes();
  renderReview();
}
function renderReview() {
  const container = $("reviewResults");
  container.replaceChildren();
  const issues = window.YeobaekProofread.findIssues(review.target.text);
  issues.forEach((issue) => {
    const row = element("div", "review-row");
    const change = element("div", "review-change");
    const apply = element("button", "", "수정");
    apply.onclick = () => applyCorrections([issue]);
    change.append(
      element("del", "", issue.original),
      element("span", "", "→"),
      element("strong", "", issue.replacement),
      apply,
    );
    const context = review.target.text.slice(
      Math.max(0, issue.start - 22),
      Math.min(review.target.text.length, issue.end + 22),
    );
    row.append(
      change,
      element("p", "review-context", context),
      element("small", "", issue.reason),
    );
    container.append(row);
  });
  if (!issues.length) {
    const empty = element("div", "review-empty");
    empty.append(
      element(
        "h3",
        "",
        review.lastApplied
          ? "수정한 내용을 반영했습니다."
          : "기본 검수에서 발견한 오타가 없습니다.",
      ),
      element("p", "", "고유명사와 문맥, 띄어쓰기는 한 번 더 읽어보세요."),
    );
    container.append(empty);
  }
  $("reviewSummary").replaceChildren(
    element("span", "", issues.length + "개의 수정 제안"),
  );
  if (review.lastApplied) {
    const undo = element("button", "undo-button", "마지막 수정 되돌리기");
    undo.onclick = () => {
      if (review.target.text !== review.lastApplied.after)
        return toast("원고가 변경되어 되돌릴 수 없습니다.");
      review.target.text = review.lastApplied.before;
      review.lastApplied = null;
      persist();
      $("editor").value = review.target.text;
      counts();
      renderScenes();
      renderReview();
    };
    $("reviewSummary").append(document.createTextNode(" · "), undo);
  }
  $("applyAll").disabled = !issues.length;
  $("applyAll").textContent = issues.length
    ? "모두 수정 (" + issues.length + ")"
    : "검수 완료";
  $("applyAll").onclick = () => applyCorrections(issues);
}
render();
if (loadProblem) {
  hasStorageError = true;
  $("saved").textContent = "저장 자료 확인 필요";
  toast(loadProblem);
}
