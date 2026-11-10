/* FEUARTS interactions: section navigation, gallery, and artwork submissions. */
(() => {
  "use strict";

  const config = window.FEUARTS_CONFIG || {};
  const artworks = window.FEUARTS_ARTWORKS || [];
  const events = window.FEUARTS_EVENTS || [];
  const categories = {
    digital: "Digital Art", traditional: "Traditional Art", photo: "Photography",
    video: "Videography", design: "Graphic Design"
  };
  const pageSize = Math.max(1, Number(config.galleryPageSize) || 3);
  const maxImageBytes = (Number(config.maxImageMB) || 10) * 1024 * 1024;
  const $ = (selector) => document.querySelector(selector);
  let currentCategory = "all";
  let visibleCount = pageSize;
  let databasePromise;
  let submissionObjectUrls = [];
  let previewObjectUrl = "";
  let selectionVersion = 0;
  let selectedImage = null;
  let validationPromise = Promise.resolve(null);
  let submitting = false;

  // Use textContent for all supplied artwork details, never untrusted HTML.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeImageUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, document.baseURI);
      return ["http:", "https:", "file:", "blob:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function safeWebsiteUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function placeholder(label) {
    const block = element("div", "image-placeholder");
    const icon = element("span", "placeholder-frame", "+");
    icon.setAttribute("aria-hidden", "true");
    block.append(icon, element("span", "", label));
    return block;
  }

  function fillMedia(container, imagePath, alt, emptyLabel) {
    container.replaceChildren();
    const src = safeImageUrl(imagePath);
    if (!src) {
      container.append(placeholder(emptyLabel));
      return;
    }
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      container.replaceChildren(placeholder("Image unavailable - check the image file."));
    }, { once: true });
    container.append(image);
  }

  function showViewer(work) {
    $("#viewerTitle").textContent = work.title;
    fillMedia($("#viewerMedia"), work.image, `${work.title} by ${work.artist}`, "Artwork image will be added here.");
    $("#viewerCredit").textContent = [work.artist, work.section, categories[work.category]].filter(Boolean).join(" / ");
    bootstrap.Modal.getOrCreateInstance($("#viewerModal")).show();
  }

  function makeArtworkCard(work, featured = false) {
    const column = element("div", featured ? "col-md-4" : "col-md-6 col-lg-4");
    const card = element("article", "art-card");
    const media = element("button", "art-media");
    media.type = "button";
    media.setAttribute("aria-label", `View ${work.title} by ${work.artist}`);
    fillMedia(media, work.image, `${work.title} by ${work.artist}`, "Artwork image to be added");
    media.addEventListener("click", () => showViewer(work));
    const body = element("div", "art-card-body");
    body.append(
      element("span", "art-category", categories[work.category] || "Artwork"),
      element("h3", "", work.title),
      element("p", "artist-credit", work.artist)
    );
    if (work.section) body.append(element("p", "artist-credit", work.section));
    card.append(media, body);
    column.append(card);
    return column;
  }

  function renderGallery() {
    const matches = artworks.filter((work) => currentCategory === "all" || work.category === currentCategory);
    const shown = matches.slice(0, visibleCount);
    $("#galleryGrid").replaceChildren(...shown.map((work) => makeArtworkCard(work)));
    $("#galleryCategoryTitle").textContent = currentCategory === "all" ? "All artworks" : categories[currentCategory];
    $("#galleryCount").textContent = matches.length ? `Showing ${shown.length} of ${matches.length} artworks` : "";
    $("#galleryEmpty").hidden = matches.length !== 0;
    const moreButton = $("#seeMoreButton");
    moreButton.hidden = matches.length <= pageSize;
    moreButton.textContent = shown.length < matches.length ? "See more" : "See less";
    moreButton.setAttribute("aria-expanded", String(visibleCount > pageSize));
  }

  function initializeContent() {
    const featured = artworks.filter((work) => work.featured).slice(0, 3);
    $("#featuredGrid").replaceChildren(...featured.map((work) => makeArtworkCard(work, true)));
    for (const event of events) {
      const column = element("div", "col-md-6 col-lg-4");
      const card = element("article", "event-card");
      const media = element("div", "event-media");
      fillMedia(media, event.image, `${event.title} event poster`, "Event poster to be added");
      const posterLink = element("a", "event-poster-link");
      posterLink.href = event.link;
      posterLink.target = "_blank";
      posterLink.rel = "noopener noreferrer";
      posterLink.setAttribute("aria-label", `View ${event.title} event post on Facebook (opens in a new tab)`);
      posterLink.append(media);
      const body = element("div", "event-card-body");
      body.append(element("h3", "", event.title), element("p", "", event.description));
      card.append(posterLink, body);
      column.append(card);
      $("#eventsGrid").append(column);
    }
    document.querySelectorAll("[data-config-image]").forEach((container) => {
      fillMedia(container, config[container.dataset.configImage], container.dataset.alt, container.dataset.label);
    });
    const logo = $("#brandLogo");
    if (safeImageUrl(config.logoImage)) {
      logo.src = safeImageUrl(config.logoImage);
      logo.hidden = false;
      logo.addEventListener("error", () => { logo.hidden = true; });
    }
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        currentCategory = button.dataset.filter;
        visibleCount = pageSize;
        document.querySelectorAll("[data-filter]").forEach((other) => {
          const active = other === button;
          other.classList.toggle("selected", active);
          other.setAttribute("aria-pressed", String(active));
        });
        renderGallery();
      });
    });
    $("#seeMoreButton").addEventListener("click", () => {
      const total = artworks.filter((work) => currentCategory === "all" || work.category === currentCategory).length;
      const collapsing = visibleCount >= total;
      visibleCount = collapsing ? pageSize : visibleCount + pageSize;
      renderGallery();
      if (collapsing) $("#galleryCategoryTitle").scrollIntoView({ behavior: preferredScroll() });
    });
    renderGallery();
  }

  function preferredScroll() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  function navigateTo(target, updateHistory = true) {
    if (!target) return;
    if (updateHistory && window.location.hash !== `#${target.id}`) {
      try { history.pushState(null, "", `#${target.id}`); } catch { /* Scroll still works on restrictive local file origins. */ }
    }
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ behavior: preferredScroll(), block: "start" });
    target.focus({ preventScroll: true });
  }

  function initializeNavigation() {
    const header = $(".site-header");
    const menu = $("#mainNav");
    const sections = [...document.querySelectorAll("main > .page-section")];
    const links = [...document.querySelectorAll("#mainNav .nav-link")];
    function setHeaderHeight() {
      document.documentElement.style.setProperty("--header-height", `${header.getBoundingClientRect().height}px`);
    }
    new ResizeObserver(setHeaderHeight).observe(header);
    setHeaderHeight();
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        if (menu.classList.contains("show")) {
          menu.addEventListener("hidden.bs.collapse", () => {
            setHeaderHeight();
            navigateTo(target);
          }, { once: true });
          bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false }).hide();
        } else navigateTo(target);
      });
    });
    let scheduled = false;
    function markCurrentSection() {
      let active = sections[0].id;
      const threshold = header.getBoundingClientRect().height + 70;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold) active = section.id;
      }
      links.forEach((link) => {
        const selected = link.hash === `#${active}`;
        link.classList.toggle("active", selected);
        if (selected) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      scheduled = false;
    }
    window.addEventListener("scroll", () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(markCurrentSection); }
    }, { passive: true });
    window.addEventListener("popstate", () => navigateTo(document.getElementById(location.hash.slice(1) || "home"), false));
    markCurrentSection();
    if (location.hash) {
      requestAnimationFrame(() => navigateTo(document.getElementById(location.hash.slice(1)), false));
    }
  }

  function initializeLinksAndContact() {
    const email = config.contactEmail || "feuturearts@gmail.com";
    $("#contactEmail").textContent = email;
    $("#contactEmail").href = `mailto:${email}`;
    let configuredSocials = 0;
    for (const [key, label] of Object.entries({ instagram: "Instagram", facebook: "Facebook", discord: "Discord" })) {
      const url = safeWebsiteUrl((config.socialLinks || {})[key]);
      const chip = element(url ? "a" : "span", `social-chip${url ? "" : " unavailable"}`, label);
      // Use the actual social-media PNGs provided by FEUARTS.
      const socialIconPaths = {
        instagram: "images/social-icons/INSTAGRAM.png",
        facebook: "images/social-icons/FACEBOOK.png",
        discord: "images/social-icons/DISCORD.png"
      };
      const socialIcon = document.createElement("img");
      socialIcon.src = socialIconPaths[key];
      socialIcon.alt = "";
      socialIcon.className = "social-icon-png";
      socialIcon.loading = "lazy";
      chip.prepend(socialIcon);
      if (url) {
        chip.href = url;
        chip.target = "_blank";
        chip.rel = "noopener noreferrer";
        configuredSocials++;
      } else chip.title = "Official link not yet provided";
      $("#socialLinks").append(chip);
    }
    $("#socialHint").hidden = configuredSocials === 3;
    const membershipUrl = safeWebsiteUrl(config.membershipUrl);
    if (membershipUrl) {
      $("#membershipLink").href = membershipUrl;
      $("#membershipLink").textContent = "Open membership application";
      $("#membershipLink").target = "_blank";
      $("#membershipLink").rel = "noopener noreferrer";
    }
    $("#contactForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      for (const input of form.querySelectorAll("input, textarea")) input.value = input.value.trim();
      if (!form.reportValidity()) return;
      const name = form.elements.name.value;
      const sender = form.elements.email.value;
      const message = form.elements.message.value;
      const subject = encodeURIComponent(`FEUARTS inquiry from ${name}`);
      const body = encodeURIComponent(`From: ${name}\nEmail: ${sender}\n\n${message}`);
      $("#contactStatus").textContent = "An email draft was requested. Send it through your email app; this page has not sent a message.";
      $("#contactStatus").hidden = false;
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    });
  }

  // Browser-only storage. A successful transaction is required before success is shown.
  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("Browser storage is unavailable. Open the site using Live Server in a regular browser window."));
        return;
      }
      let finished = false;
      let request;
      const timer = setTimeout(() => {
        finished = true;
        reject(new Error("Browser storage could not be opened. Close other copies of this site and try again."));
      }, 7000);
      try { request = indexedDB.open("feuarts-artwork-submissions", 1); }
      catch (error) { clearTimeout(timer); reject(error); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("submissions")) db.createObjectStore("submissions", { keyPath: "id" });
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (finished) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error || new Error("Browser storage could not be opened."));
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finished = true;
        reject(new Error("Another tab is using an older copy. Close it and reload this page."));
      };
    });
    databasePromise.catch(() => { databasePromise = undefined; });
    return databasePromise;
  }

  async function writeSubmission(record, remove = false) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("submissions", "readwrite");
      const store = transaction.objectStore("submissions");
      if (remove) store.delete(record.id);
      else store.put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the submission."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving was cancelled by the browser."));
    });
  }

  async function readSubmissions() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction("submissions", "readonly").objectStore("submissions").getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      request.onerror = () => reject(request.error);
    });
  }

  async function renderLocalSubmissions() {
    try {
      const submissions = await readSubmissions();
      submissionObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      submissionObjectUrls = [];
      $("#submissionsGrid").replaceChildren();
      for (const submission of submissions) {
        const url = URL.createObjectURL(submission.image);
        submissionObjectUrls.push(url);
        const work = { title: submission.title, artist: submission.artistName, section: submission.section, category: submission.category, image: url };
        const column = makeArtworkCard(work);
        const body = column.querySelector(".art-card-body");
        body.append(element("p", "submission-meta mt-2", `${submission.year} / ${submission.program}`));
        const remove = element("button", "remove-submission mt-2", "Remove from this browser");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${submission.title} from this browser`);
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Remove "${submission.title}" and its saved details from this browser?`)) return;
          remove.disabled = true;
          try {
            await writeSubmission(submission, true);
            await renderLocalSubmissions();
            $("#storageNotice").textContent = "The local submission was removed from this browser.";
            $("#storageNotice").hidden = false;
          } catch {
            $("#storageNotice").textContent = "The submission could not be removed. Please reload and try again.";
            $("#storageNotice").hidden = false;
            remove.disabled = false;
          }
        });
        body.append(remove);
        $("#submissionsGrid").append(column);
      }
      $("#localSubmissions").hidden = submissions.length === 0;
    } catch {
      $("#storageNotice").textContent = "Local saving is unavailable in this browser session. Try Live Server and allow site storage before submitting.";
      $("#storageNotice").hidden = false;
    }
  }

  function resetImagePreview() {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = "";
    selectedImage = null;
    $("#previewImage").removeAttribute("src");
    $("#imagePreview").hidden = true;
    $("#uploadError").hidden = true;
    $("#artworkImage").setCustomValidity("");
  }

  // Check the actual file signature and decode it, not just its extension.
  async function inspectImage(file) {
    if (file.size > maxImageBytes) throw new Error(`Choose an image no larger than ${config.maxImageMB || 10} MB.`);
    if (file.size === 0) throw new Error("This image file is empty. Please choose another file.");
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = String.fromCharCode(...bytes);
    let mime = "";
    if (bytes[0] === 0x89 && text.slice(1, 4) === "PNG" && bytes[4] === 13 && bytes[5] === 10) mime = "image/png";
    else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = "image/jpeg";
    else if (text.startsWith("GIF87a") || text.startsWith("GIF89a")) mime = "image/gif";
    else if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") mime = "image/webp";
    if (!mime || (file.type && file.type !== mime)) throw new Error("Please choose a real JPG, PNG, WebP or GIF image.");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("Invalid image dimensions.");
      if (image.naturalWidth * image.naturalHeight > 50000000) throw new Error("Please choose an image under 50 megapixels.");
      return { file, mime, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) {
      if (error.message.includes("megapixels")) throw error;
      throw new Error("This file cannot be read as an image. Please choose a different file.");
    } finally { URL.revokeObjectURL(url); }
  }

  function showResult(message, error = false) {
    const result = $("#submissionResult");
    result.textContent = message;
    result.classList.toggle("error", error);
    result.hidden = false;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ block: "nearest", behavior: preferredScroll() });
  }

  async function sendToReceiver(record) {
    const endpoint = new URL(config.artworkEndpoint);
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) {
      throw new Error("The artwork submission service must use HTTPS.");
    }
    const payload = new FormData();
    for (const field of ["artistName", "section", "year", "program", "title", "category", "createdAt"]) payload.append(field, record[field]);
    payload.append("submissionId", record.id);
    payload.append("permission", "true");
    payload.append("image", record.image, record.originalFilename);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(endpoint.href, { method: "POST", body: payload, headers: { Accept: "application/json" }, credentials: "omit", signal: controller.signal });
      const confirmation = await response.json().catch(() => null);
      if (!response.ok || confirmation?.success !== true) throw new Error("The submission service did not confirm a successful upload.");
    } finally { clearTimeout(timer); }
  }

  function initializeSubmissionForm() {
    const form = $("#artworkForm");
    const imageInput = $("#artworkImage");
    const submitButton = $("#submitArtworkButton");
    const liveMode = Boolean(String(config.artworkEndpoint || "").trim());
    const defaultButtonText = liveMode ? "Submit artwork" : "Save submission";
    submitButton.textContent = defaultButtonText;
    $("#uploadHint").textContent = `JPG, PNG, WebP or GIF, up to ${config.maxImageMB || 10} MB. For videography, upload a poster or still image.`;
    if (liveMode) {
      $("#submissionModeNote").textContent = "This form is configured to send your image and details to the organization's submission service. Submitting does not automatically publish your artwork in the gallery.";
    }

    imageInput.addEventListener("change", () => {
      const version = ++selectionVersion;
      resetImagePreview();
      $("#submissionResult").hidden = true;
      $("#viewSavedSubmission").hidden = true;
      const file = imageInput.files[0];
      if (!file) { validationPromise = Promise.resolve(null); submitButton.disabled = submitting; return; }
      submitButton.disabled = true;
      validationPromise = inspectImage(file).then((info) => {
        if (version !== selectionVersion) return null;
        selectedImage = info;
        previewObjectUrl = URL.createObjectURL(file);
        $("#previewImage").src = previewObjectUrl;
        $("#previewCaption").textContent = `${file.name} / ${info.width} x ${info.height} px / ${(file.size / 1024 / 1024).toFixed(2)} MB`;
        $("#imagePreview").hidden = false;
        return info;
      }).catch((error) => {
        if (version === selectionVersion) {
          imageInput.setCustomValidity(error.message);
          $("#uploadError").textContent = error.message;
          $("#uploadError").hidden = false;
        }
        return null;
      }).finally(() => {
        if (version === selectionVersion && !submitting) submitButton.disabled = false;
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      $("#submissionResult").hidden = true;
      $("#viewSavedSubmission").hidden = true;
      for (const input of form.querySelectorAll('input:not([type="file"]):not([type="checkbox"])')) input.value = input.value.trim();
      form.classList.add("was-validated");
      if (!form.checkValidity()) { form.querySelector(":invalid")?.focus(); return; }
      submitting = true;
      submitButton.disabled = true;
      submitButton.textContent = liveMode ? "Submitting..." : "Saving...";
      try {
        const imageInfo = await validationPromise;
        if (!imageInfo || !selectedImage) throw new Error("Please choose a supported image before submitting.");
        const record = {
          id: window.crypto?.randomUUID ? crypto.randomUUID() : `art-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          artistName: form.elements.artistName.value,
          section: form.elements.section.value,
          year: form.elements.year.value,
          program: form.elements.program.value,
          title: form.elements.title.value,
          category: form.elements.category.value,
          image: imageInfo.file,
          originalFilename: imageInfo.file.name,
          mime: imageInfo.mime,
          createdAt: new Date().toISOString()
        };
        // Lock fields during a save/upload to prevent changing the image midway.
        for (const input of form.querySelectorAll("input, select")) input.disabled = true;
        if (liveMode) {
          await sendToReceiver(record);
          showResult("The configured submission service confirmed receipt of your artwork and details. Your work has not been automatically added to the public gallery.");
        } else {
          await writeSubmission(record);
          await renderLocalSubmissions();
          showResult("Saved on this browser. Your artwork and details are stored here for this demo. They have not been sent to FEUARTS or published for other visitors.");
          $("#viewSavedSubmission").hidden = false;
        }
        form.reset();
        form.classList.remove("was-validated");
        ++selectionVersion;
        resetImagePreview();
        validationPromise = Promise.resolve(null);
      } catch (error) {
        let message;
        if (error.name === "QuotaExceededError") message = "This browser is out of storage. Remove an older local submission or use a smaller image and try again.";
        else if (liveMode) message = "The upload could not be confirmed. Check your connection or contact FEUARTS before retrying. Your form has been kept.";
        else message = `Could not save the artwork. ${error.message || "Allow browser storage and try again."} Your form has been kept.`;
        showResult(message, true);
      } finally {
        submitting = false;
        for (const input of form.querySelectorAll("input, select")) input.disabled = false;
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    });

    $("#viewSavedSubmission").addEventListener("click", () => {
      $("#artworkModal").addEventListener("hidden.bs.modal", () => navigateTo($("#localSubmissions"), false), { once: true });
      bootstrap.Modal.getOrCreateInstance($("#artworkModal")).hide();
    });
    $("#artworkModal").addEventListener("shown.bs.modal", () => {
      if (!submitting) $("#artistName").focus({ preventScroll: true });
    });
    $("#artworkModal").addEventListener("hide.bs.modal", (event) => {
      if (submitting) event.preventDefault();
    });
    renderLocalSubmissions();
  }

  initializeContent();
  initializeNavigation();
  initializeLinksAndContact();
  initializeSubmissionForm();
})();
