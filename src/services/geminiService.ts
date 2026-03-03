export async function removeBackground(base64Image: string): Promise<string> {
  const apiKey = '3a042e24a46a5385447af5b072d09af1a219a1c49f3d25350bb63ca49ff634fe051a3927eb4782d1883672f9bd16e5b8';

  // Convert base64 to blob
  const res = await fetch(base64Image);
  const blob = await res.blob();

  const form = new FormData();
  form.append('image_file', blob);

  const apiResponse = await fetch('https://clipdrop-api.co/remove-background/v1', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
    },
    body: form,
  });

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(`ClipDrop API error: ${apiResponse.status} ${errorText}`);
  }

  const buffer = await apiResponse.arrayBuffer();

  // Convert buffer to base64
  const base64 = btoa(
    new Uint8Array(buffer)
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  return `data:image/png;base64,${base64}`;
}

export async function mergeWithBackground(personBase64s: string | string[], bgPath: string, frameId?: string): Promise<string> {
  const persons = Array.isArray(personBase64s) ? personBase64s : [personBase64s];
  const id = frameId?.toLowerCase() || bgPath.toLowerCase();

  return new Promise((resolve, reject) => {
    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";

    bgImg.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Draw background
      ctx.drawImage(bgImg, 0, 0);

      // Load and draw all persons
      const personImages = await Promise.all(persons.map(src => {
        return new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => res(img);
          img.onerror = () => rej(new Error("Failed to load person image"));
          img.src = src;
        });
      }));

      // Arrangement logic for multiple photos
      const count = personImages.length;

      personImages.forEach((personImg, index) => {
        let heightFactor = 0.85;
        let yFactor = 0.10;

        if (id.includes('vogue2') || id.includes('vogue3')) {
          heightFactor = 1.15; // Make them significantly larger
          yFactor = -0.05; // Shift up to overlap the top text
        } else if (id.includes('vogue')) {
          heightFactor = 1.0;
          yFactor = 0;
        } else if (id.includes('numero')) {
          yFactor = 0.18;
        }

        const targetHeight = bgImg.height * heightFactor;
        const aspectRatio = personImg.width / personImg.height;
        const targetWidth = targetHeight * aspectRatio;

        // If multiple images, offset them slightly or arrange them
        // For 3 images, let's overlap them or put them side by side
        let xOffset = 0;
        if (count > 1) {
          const totalSpread = bgImg.width * 0.4; // Spread across 40% of width
          xOffset = (index - (count - 1) / 2) * (totalSpread / (count - 1 || 1));
        }

        const x = (bgImg.width - targetWidth) / 2 + xOffset;
        const y = bgImg.height * yFactor;

        // Add a slight rotation to multiple images for a "collage" feel if not Vogue
        if (count > 1 && !id.includes('vogue')) {
          ctx.save();
          ctx.translate(x + targetWidth / 2, y + targetHeight / 2);
          ctx.rotate((index - 1) * 0.05); // Rotate slightly
          ctx.drawImage(personImg, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
          ctx.restore();
        } else {
          ctx.drawImage(personImg, x, y, targetWidth, targetHeight);
        }
      });

      resolve(canvas.toDataURL('image/png'));
    };

    bgImg.onerror = () => reject(new Error("Failed to load background image"));
    bgImg.src = `${bgPath}?t=${Date.now()}`;
  });
}

export async function overlayForeground(baseImageBase64: string, fgPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    const fgImg = new Image();

    baseImg.crossOrigin = "anonymous";
    fgImg.crossOrigin = "anonymous";

    baseImg.onload = () => {
      fgImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw base image
        ctx.drawImage(baseImg, 0, 0);

        // Draw foreground layer
        ctx.drawImage(fgImg, 0, 0, baseImg.width, baseImg.height);

        resolve(canvas.toDataURL('image/png'));
      };
      fgImg.src = `${fgPath}?t=${Date.now()}`;
    };

    baseImg.onerror = () => reject(new Error("Failed to load base image"));
    fgImg.onerror = () => reject(new Error("Failed to load foreground image"));

    baseImg.src = baseImageBase64;
  });
}
