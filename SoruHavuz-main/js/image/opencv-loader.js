// OpenCV isteğe bağlıdır: yüklenemezse uygulama Canvas tabanlı manuel akışla devam eder.
let openCvPromise;

export function loadOpenCv() {
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (openCvPromise) return openCvPromise;

  openCvPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.10.0/opencv.js";
    script.async = true;
    script.onload = () => {
      const startedAt = Date.now();
      const waitForRuntime = () => {
        if (window.cv?.Mat) return resolve(window.cv);
        if (Date.now() - startedAt > 12000) return reject(new Error("OpenCV başlatılamadı."));
        setTimeout(waitForRuntime, 50);
      };
      waitForRuntime();
    };
    script.onerror = () => reject(new Error("OpenCV indirilemedi."));
    document.head.appendChild(script);
  });
  return openCvPromise;
}
