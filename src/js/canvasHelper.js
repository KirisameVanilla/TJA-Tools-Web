let sprites;

export function drawLine(ctx, sx, sy, ex, ey, width, stroke, eventCover = null, avoidText = false) {
    if (avoidText && eventCover) {
        // Check if the line intersects with any of the eventCover regions
        let points = [{ x: sx, y: sy }, { x: ex, y: ey }];
        let avoideds = [];

        eventCover.forEach(region => {
            const { stx, sty, enx, eny } = region;
            const coverPoints = [
                { x: stx, y: sty },
                { x: enx, y: sty },
                { x: enx, y: eny },
                { x: stx, y: eny }
            ];

            let intersections = [];
            for (let i = 0; i < coverPoints.length; i++) {
                let p1 = coverPoints[i];
                let p2 = coverPoints[(i + 1) % coverPoints.length];
                let intersection = getLineIntersection(points[0], points[1], p1, p2);
                if (intersection) intersections.push(intersection);
            }
            if (intersections.length <= 1)
                return;
            intersections.sort((a, b) => a.t - b.t);
            let avoided = [intersections[0], intersections[intersections.length - 1]];
            if (avoided[1].t <= 0 || avoided[0].t >= 1)
                return;
            avoideds.push(avoided);
        });

        avoideds.sort((a, b) => a[0].t - b[0].t);

        ctx.lineWidth = width;
        ctx.strokeStyle = stroke;
        ctx.beginPath();

        let t = 0;
        ctx.moveTo(sx, sy); // |t

        avoideds.forEach(points => {
            if (points[1].t <= t) // [ ] t
                return;
            if (points[0].t > t) { // t [ ] => --[t ]
                t = points[0].t;
                if (t > 1) {
                    ctx.lineTo(ex, ex);
                    return;
                }
                ctx.lineTo(points[0].x, points[0].y);
            }
            // [ t ] => [ ]t
            t = points[1].t;
            ctx.moveTo(points[1].x, points[1].y);
        });

        if (t <= 1) { // t | => --|t
            ctx.lineTo(ex, ey);
        }
        ctx.stroke();
        ctx.closePath();
    } else {
        drawSimpleLine(ctx, sx, sy, ex, ey, width, stroke);
    }
}

function drawSimpleLine(ctx, sx, sy, ex, ey, width, stroke) {
    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.closePath();
}

function getLineIntersection(p0, p1, p2, p3) {
    const s1_x = p1.x - p0.x;
    const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x;
    const s2_y = p3.y - p2.y;

    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1) {
        return {
            x: p0.x + (t * s1_x),
            y: p0.y + (t * s1_y),
            t: t,
        };
    }
    return null;
}

function distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/*
export function drawLine(ctx, sx, sy, ex, ey, width, stroke, eventCover = null, avoidText = false) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);

    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;

    ctx.stroke();
    ctx.closePath();
}
*/

export function drawCircle(ctx, x, y, radius, fill) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.closePath();
}

export function drawCircleLeftHalf(ctx, x, y, radius, fill) {
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.PI / 2, 3 * Math.PI / 2, false);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.closePath();
}

export function drawCircleRightHalf(ctx, x, y, radius, fill) {
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, false);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.closePath();
}

export function drawRect(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
}

export function drawText(ctx, x, y, text, font, color, baseline = 'middle', textAlign = 'center', stroke = false) {
    ctx.font = font;
    ctx.textBaseline = baseline;
    ctx.textAlign = textAlign;
	if (stroke) {
		ctx.fillStyle = '#fff';
		ctx.strokeStyle = color;
		ctx.lineWidth = 5;
		ctx.lineJoin = 'miter';
		ctx.miterLimit = 2;
		ctx.strokeText(text, x, y);
		ctx.fillText(text, x, y);
	}
	else {
		ctx.fillStyle = color;
		ctx.fillText(text, x, y);
	}
}

export function drawPixelText(ctx, x, y, text, color, baseline = 'middle', textAlign = 'center') {
    drawText(ctx, x, y, text, '5px "Pixel 3x5"', color, baseline, textAlign);
}

export function drawSprite(ctx, x, y, key, type) {
	ctx.drawImage(sprites[type][key], x, y);
}

export function drawImageText(ctx, x, y, text, type) {
	for (let i = 0; i < text.length; i++) {
		const keyChar = text.charAt(i);
		drawSprite(ctx, x + (i * 6), y, keyChar, type);
	}
}

export function initSprites() {
	return new Promise((resolve, reject) => {
		const data = require('./sprite/sprite.js').default;
		let outdata = {};
		let total = 0;

		for (let type in data) {
			for (let key in data[type]) {
				total++;
			}
		}

		let loadCount = 0;
		for (let type in data) {
			outdata[type] = {};
			if (type === 'num')
				outdata['fuseNum'] = {};
			for (let key in data[type]) {
				let img = new Image();
				img.src = data[type][key];
				img.onload = () => {
					outdata[type][key] = img;
					if (type === 'num') {
						// draw a recolored `num` digit for `fuseNum`
						let c = document.createElement('canvas');
						c.width = img.width;
						c.height = img.height;
						let ctx = c.getContext('2d');
						ctx.drawImage(img, 0, 0);
						ctx.globalCompositeOperation = 'source-atop';
						ctx.fillStyle = '#fcc';
						ctx.fillRect(0, 0, img.width, img.height);
						ctx.globalCompositeOperation = 'source-over';
						outdata['fuseNum'][key] = c;
					}
					loadCount++;

					if (loadCount === total) {
						sprites = outdata;
						resolve();
					}
				}
			}
		}
	});
}
