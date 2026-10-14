// ============================================================================
// camera/capture.js
//
// Iki yakalama yontemi sunulur:
//   1) <input type="file" accept="image/*" capture="environment">  (basit, guvenilir,
//      build gerektirmez, cogu mobil tarayicida dogrudan arka kamerayi acar)
//   2) navigator.mediaDevices.getUserMedia()                        (ozel, canli
//      onizlemeli kamera ekrani - masaustu tarayicilarda ve capture
//      niteligini desteklemeyen ortamlarda (ör. bazı masaüstü Chrome/Firefox
//      sürümleri) tercih edilir; ekle.html zaten Cropper.js yuklüyor, o yuzden
//      cekilen kareyi ayni kırpma akışına devrediyoruz.)
// ============================================================================

/**
 * Gizli bir <input type="file"> olusturup tiklatir, secilen dosyayi
 * Promise ile doner. capture="environment" mobilde dogrudan arka kamerayi acar.
 */
export function pickImageFromCamera() {
  return pickImageFile({ capture: "environment" });
}

export function pickImageFromGallery() {
  return pickImageFile({ capture: null });
}

function pickImageFile({ capture }) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.capture = capture;
    input.style.display = "none";

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] || null;
        input.remove();
        if (!file) {
          reject(new Error("Dosya seçilmedi."));
          return;
        }
        resolve(file);
      },
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * getUserMedia tabanli canli kamera ekrani. Tam ekran bir overlay acar,
 * video akisini gosterir ve kullanici cekim yaptiginda akisi durdurup
 * kareyi bir File nesnesine (image/jpeg) donusturur.
 *
 * @param {Object} [options]
 * @param {"environment"|"user"} [options.facingMode="environment"] Tercih edilen kamera yonu.
 * @returns {Promise<File>} Cekilen kare.
 * @throws {Error} Kamera erisimi reddedilir/desteklenmezse veya kullanici iptal ederse.
 */
export async function openLiveCameraStream({ facingMode = "environment" } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Bu tarayıcı canlı kamera akışını desteklemiyor. Lütfen 'Galeriden Seç' veya dosya seçici kamera butonunu kullanın.");
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } },
      audio: false
    });
  } catch (error) {
    throw new Error(`Kamera erişimi alınamadı: ${error.message || error.name}`);
  }

  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.className = "live-camera-overlay";
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "10000",
      background: "#000", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center"
    });

    const video = document.createElement("video");
    Object.assign(video.style, { width: "100%", height: "calc(100% - 76px)", objectFit: "contain", background: "#000" });
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const controls = document.createElement("div");
    Object.assign(controls.style, {
      display: "flex", gap: "16px", alignItems: "center", justifyContent: "center",
      height: "76px", width: "100%"
    });

    const shootBtn = document.createElement("button");
    shootBtn.type = "button";
    shootBtn.textContent = "📷 Çek";
    shootBtn.className = "secondary";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "İptal";
    cancelBtn.className = "secondary";

    controls.append(shootBtn, cancelBtn);
    overlay.append(video, controls);
    document.body.appendChild(overlay);

    function cleanup() {
      stream.getTracks().forEach((track) => track.stop());
      overlay.remove();
    }

    cancelBtn.addEventListener("click", () => {
      cleanup();
      reject(new Error("Canlı kamera çekimi iptal edildi."));
    });

    shootBtn.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (!blob) {
            reject(new Error("Kare yakalanamadı."));
            return;
          }
          resolve(new File([blob], `kamera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92
      );
    });
  });
}
