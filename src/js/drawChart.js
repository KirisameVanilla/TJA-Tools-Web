import { drawLine, drawCircle, drawCircleRightHalf, drawRect, drawText, drawPixelText, drawSprite, drawImageText, initSprites } from './canvasHelper';
import { isRollType } from './parseTJA';
import { toFixedZero } from './main';
import { getFontSetting, getTextPositionY, getUraSymbol } from './font/font';

//==============================================================================
// Drawing config and helpers

const CHART_PADDING_TOP = {MIN: 62, current: 62};
const CHART_PADDING_BOTTOM = -14;
const CHART_BG = '#cccccc';

const ROW_MARGIN_BOTTOM = 14;
const ROW_HEIGHT_INFO = 18;
const ROW_HEIGHT_NOTE = 32;
const ROW_HEIGHT = ROW_HEIGHT_INFO + ROW_HEIGHT_NOTE;
const ROW_OFFSET_NOTE_CENTER = ROW_HEIGHT_INFO + (ROW_HEIGHT_NOTE / 2);
const ROW_LEADING = 24;
const ROW_TRAILING = 24;

const BEAT_WIDTH = 48;

const NOTE_RADIUS = 9;

const GET_ROW_Y = row => CHART_PADDING_TOP.current + ((ROW_HEIGHT + ROW_MARGIN_BOTTOM) * row);
const GET_BEAT_X = beat => ROW_LEADING + (beat * BEAT_WIDTH);

const GET_MEASURE_POS_BEAT = (measure, position) => measure.rowBeat + (measure.nBeats / measure.nDivisions * position);
const GET_MEASURE_POS_BEAT_NOTE = (measure, position) => measure.rowBeat + (measure.nBeatNotes / measure.nDivisions * position);

const GET_BEAT_ROW_MIDX = (row, beat) => row.measures.findLastIndex(m => (m.rowBeat <= beat));

let rowDeltas = [];
const branchTypes = ['N','E','M'];

function sumNums(array, offset = -1) {
	let result = 0;
	if (offset === -1) {
		offset = array.length;
	}
	
	for (let i = 0; i < array.length; i++) {
		if (i === offset) {
			break;
		}
		result += array[i];
	}
	
	return result;
}

export function compareArray(array1, array2) {
    if (array1.length !== array2.length) {
        return false;
    }

    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }

    return true;
}

//==============================================================================
// Notes

function getNoteCenter(row, beat) {
    return {
        x: GET_BEAT_X(beat),
        y: GET_ROW_Y(row) + ROW_OFFSET_NOTE_CENTER + sumNums(rowDeltas, row),
    };
}

function drawSmallNote(ctx, x, y, color, drawInner = true, side = 'all') {
    const draw = (side === 'left') ? drawCircleLeftHalf
        : (side === 'right') ? drawCircleRightHalf
        : drawCircle;

    draw(ctx, x, y, NOTE_RADIUS, '#2e2e2e');

    if (drawInner) {
        draw(ctx, x, y, NOTE_RADIUS - 1, '#fff');
        draw(ctx, x, y, NOTE_RADIUS - 2, color);
    }
    else {
        draw(ctx, x, y, NOTE_RADIUS - 1, color);
    }
}

function drawNoteSprite(ctx, row, yDelta, beat, type) {
	const { x, y } = getNoteCenter(row, beat);
	if (type === 'fuse')
		drawSmallNote(ctx, x, y + yDelta, '#a4f', false);
	else if (type === 'fuseEnd')
		drawSmallNote(ctx, x, y + yDelta, '#640aad', true, 'right');
	else
		drawSprite(ctx, x - 12, y - 12 + yDelta, type, 'notes');
}

//==============================================================================
// Long notes

const COLOR_GOGO = '#ffc0c0';

function drawLongOnMeasure(ctx, rows, bt, ridx, midx, sBeat, eBeat, type) {
    const isGogo = type === 'gogo';
    const sx = (sBeat > 0) ? GET_BEAT_X(sBeat)
        : isGogo ? 0
        : ROW_LEADING;
    const ex = !isNaN(eBeat) ? GET_BEAT_X(eBeat)
        : isGogo ? GET_BEAT_X(rows[ridx].totalBeat) + ROW_TRAILING
        : GET_BEAT_X(rows[ridx].totalBeat);
    let y = GET_ROW_Y(ridx) + sumNums(rowDeltas, ridx);
    if (isGogo) {
        drawRect(ctx, sx, y, ex - sx, ROW_HEIGHT_INFO, COLOR_GOGO);
    }
    else {
        const bidx = rows[ridx].measures[midx].dataBranches.indexOf(bt);
        if (bidx >= 0) {
            y += bidx * 24 + ROW_OFFSET_NOTE_CENTER - 12;
            drawRectSprite(ctx, sx, y, ex - sx, type)
        }
    }
}

function drawLongOnRow(ctx, rows, bt, ridx, sBeat, eBeat, type) {
    const sMidx = GET_BEAT_ROW_MIDX(rows[ridx], sBeat);
    const eMidx = !isNaN(eBeat) ? GET_BEAT_ROW_MIDX(rows[ridx], eBeat)
        : rows[ridx].measures.length - 1;
    if (sMidx === eMidx) {
        drawLongOnMeasure(ctx, rows, bt, ridx, sMidx, sBeat, eBeat, type);
    } else {
        // start to end-of-measure
        drawLongOnMeasure(ctx, rows, bt, ridx, sMidx, sBeat, rows[ridx].measures[sMidx + 1].rowBeat, type);

        // full measures
        for (let m = sMidx + 1; m < eMidx; ++m) {
            drawLongOnMeasure(ctx, rows, bt, ridx, m, rows[ridx].measures[m].rowBeat, rows[ridx].measures[m + 1].rowBeat, type);
        }

        // start-of-measure to end
        drawLongOnMeasure(ctx, rows, bt, ridx, eMidx, rows[ridx].measures[eMidx].rowBeat, eBeat, type);
    }
}

function drawLongSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, type) {
    if (eRow === undefined)
        eRow = rows.length - 1;

    if (sRow === eRow) {
        drawLongOnRow(ctx, rows, bt, sRow, sBeat, eBeat, type);
    }
    else {
        // start to end-of-row
        drawLongOnRow(ctx, rows, bt, sRow, sBeat, undefined, type);

        // full rows
        for (let r = sRow + 1; r < eRow; r++) {
            drawLongOnRow(ctx, rows, bt, r, 0, undefined, type);
        }

        // start-of-row to end
        drawLongOnRow(ctx, rows, bt, eRow, 0, eBeat, type);
    }
}

function drawRectSprite(ctx, x, y, w, type) {
	if (type === 'fuseMiddle') {
		y = y + 12 - NOTE_RADIUS;
		drawRect(ctx, x, y, w, 2 * NOTE_RADIUS, '#000');
		drawRect(ctx, x, y + 1, w, 2 * (NOTE_RADIUS - 1), '#fff');
		drawRect(ctx, x, y + 2, w, 2 * (NOTE_RADIUS - 2), '#640aad');
	} else {
		for (let i = 0; i < w; i++) {
			drawSprite(ctx, x + i, y, type, 'notes');
		}
	}
}

function drawRendaSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, omitEnd, type) {
	const midx = GET_BEAT_ROW_MIDX(rows[sRow], sBeat);
	const bidx = rows[sRow].measures[midx].dataBranches.indexOf(bt);
	if (eRow != undefined && !omitEnd) {
		const midxE = !isNaN(eBeat) ? GET_BEAT_ROW_MIDX(rows[eRow], eBeat) : rows[eRow].measures.length - 1;
		const bidxE = rows[eRow].measures[midxE].dataBranches.indexOf(bt);
		if (bidxE >= 0)
			drawNoteSprite(ctx, eRow, bidxE * 24, eBeat, type + 'End');
	}
	drawLongSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, type + 'Middle');
	drawNoteSprite(ctx, sRow, bidx * 24, sBeat, type + 'Start');
}

function drawBalloonSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, omitEnd, count, imo = false, spSymbol = 'kusudama') {
	let symbol = 'balloon';
	if (imo) {
		if (spSymbol === 'denden') {
			symbol = 'denden';
		}
		else if (spSymbol === 'potato') {
			symbol = 'potato';
		}
		else if (spSymbol === 'suzudon') {
			symbol = 'suzudon';
		}
		else {
			symbol = 'kusudama';
		}
	}

	const midx = GET_BEAT_ROW_MIDX(rows[sRow], sBeat);
	const bidx = rows[sRow].measures[midx].dataBranches.indexOf(bt);
	if (eRow != undefined && !omitEnd) {
		const midxE = !isNaN(eBeat) ? GET_BEAT_ROW_MIDX(rows[eRow], eBeat) : rows[eRow].measures.length - 1;
		const bidxE = rows[eRow].measures[midxE].dataBranches.indexOf(bt);
		if (bidxE >= 0)
			drawNoteSprite(ctx, eRow, bidxE * 24, eBeat, 'spRollEnd');
	}
	drawLongSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, 'spRollMiddle');
	drawNoteSprite(ctx, sRow, bidx * 24, sBeat, 'spRollStart');
	drawNoteSprite(ctx, sRow, bidx * 24, sBeat, symbol);
	
	const { x, y } = getNoteCenter(sRow, sBeat);
	const xDelta = Math.floor((count.toString().length * 6) / 2) - 3
	drawImageText(ctx, x - 3 - xDelta, y - 3 + (bidx * 24), count.toString(), 'num');
}

function drawFuseSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, omitEnd, count) {
	const midx = GET_BEAT_ROW_MIDX(rows[sRow], sBeat);
	const bidx = rows[sRow].measures[midx].dataBranches.indexOf(bt);
	if (eRow != undefined && !omitEnd) {
		const midxE = !isNaN(eBeat) ? GET_BEAT_ROW_MIDX(rows[eRow], eBeat) : rows[eRow].measures.length - 1;
		const bidxE = rows[eRow].measures[midxE].dataBranches.indexOf(bt);
		if (bidxE >= 0)
			drawNoteSprite(ctx, eRow, bidxE * 24, eBeat, 'fuseEnd');
	}
	drawLongSprite(ctx, rows, bt, sRow, sBeat, eRow, eBeat, 'fuseMiddle');
	drawNoteSprite(ctx, sRow, bidx * 24, sBeat, 'fuse');

	const { x, y } = getNoteCenter(sRow, sBeat);
	const xDelta = Math.floor((count.toString().length * 6) / 2) - 3
	drawImageText(ctx, x - 3 - xDelta, y - 3 + (bidx * 24), count.toString(), 'fuseNum');
}

//==============================================================================
// Main drawing function

export default function (chart, courseId) {	
    const course = chart.courses[courseId];

    // Useful values
    const ttRowBeat = course.headers.ttRowBeat;

    //============================================================================
    // 1. Calculate canvas size, split measures into rows

    const rows = [], midxToRmidx = [];
    let rowTemp = [], rowBeats = [0];
	let nPrevBranches = 0;
	rowDeltas = [];
	let moveLineTemp = 0;

    for (let midx = 0; midx < course.measures.length; midx++) {
        const measure = course.measures[midx];
        const measureBeat = measure.nBeats = measure.length[0] / measure.length[1] * 4;
        measure.nBeatNotes = measure.lengthNotes[0] / measure.lengthNotes[1] * 4;

		let nRowBranches = measure.dataBranches.length;

		if (measure.properties.moveLine != undefined && !isNaN(measure.properties.moveLine)) {
			moveLineTemp = measure.properties.moveLine;
		}

        if (ttRowBeat < rowBeats[rowBeats.length - 1] + measureBeat || measure.properties.ttBreak || (midx > 0 && nPrevBranches !== nRowBranches)) {
            rows.push({ totalBeat: rowBeats[rowBeats.length - 1], measures: rowTemp, nBranches: nPrevBranches, moveLine: moveLineTemp});
            rowTemp = [];
            rowBeats = [0];
        }

        midxToRmidx[midx] = [rows.length, rowTemp.length];
        rowTemp.push(measure);
        measure.rowBeat = rowBeats[rowBeats.length - 1];
        rowBeats.push(rowBeats[rowBeats.length - 1] + measureBeat);
		nPrevBranches = measure.dataBranches.length;
    }

    if (rowTemp.length)
        rows.push({ totalBeat: rowBeats[rowBeats.length - 1], measures: rowTemp, nBranches: nPrevBranches, moveLine: moveLineTemp });

	for (let ridx = 0; ridx < rows.length; ridx++) {
		rowDeltas.push((rows[ridx].nBranches - 1) * 24);
	}

	const maker = (course.headers.maker !== null) ? course.headers.maker : chart.headers.maker;
	const fontSetting = getFontSetting(chart.headers.font.toLowerCase());
	const textPositionY = getTextPositionY(fontSetting, chart.headers.subtitle, maker !== null);
	CHART_PADDING_TOP.current = textPositionY.paddingTop;

    const canvasWidth = ROW_LEADING + (BEAT_WIDTH * ttRowBeat) + ROW_TRAILING;
    const getCanvasHeight = () => CHART_PADDING_TOP.current + ((ROW_HEIGHT + ROW_MARGIN_BOTTOM) * rows.length) + CHART_PADDING_BOTTOM + sumNums(rowDeltas);
    let canvasHeight = getCanvasHeight();

    const $canvas = document.createElement('canvas');
    $canvas.width = canvasWidth;
    $canvas.height = canvasHeight;

    // Add canvas element temporarily for small font rendering
    // Ref: https://bugs.chromium.org/p/chromium/issues/detail?id=826129
    //document.body.appendChild($canvas);

    const ctx = $canvas.getContext('2d');

    try {
        //============================================================================
        // 2. Background, rows, informations

        drawRect(ctx, 0, 0, canvasWidth, canvasHeight, CHART_BG);

        for (let ridx = 0; ridx < rows.length; ridx++) {
            const row = rows[ridx];
            const measures = row.measures;

            const rowWidth = ROW_LEADING + (BEAT_WIDTH * row.totalBeat) + ROW_TRAILING;
            const y = GET_ROW_Y(ridx) + sumNums(rowDeltas, ridx);

			const rowColor1 = {'N':'#d4d4d4','E':'#c9dede','M':'#dec9c9'};
			const rowColor2 = {'N':'#aaaaaa','E':'#94bfbf','M':'#bf9494'};
			const rowColor3 = {'N':'#808080','E':'#609f9f','M':'#9f6060'};

			for (let midx = 0; midx < measures.length; ++midx) {
                const measure = row.measures[midx];
                const sx = (midx === 0) ? 0 : GET_BEAT_X(measure.rowBeat);
                const ex = (midx + 1 >= measures.length) ? rowWidth : GET_BEAT_X(row.measures[midx + 1].rowBeat);
                const w = ex - sx;
				let rowOffset = 0;

				drawRect(ctx, sx, y + ROW_HEIGHT_INFO, w, 2, '#000');
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + 2, w, 2, '#fff');
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + 4, w, 1, rowColor1[measure.dataBranches[0]]);
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + 5, w, 1, rowColor2[measure.dataBranches[0]]);
				rowOffset += 6;

				switch (measure.dataBranches.length) {
					case 1:
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 12, rowColor3[measure.dataBranches[0]]);
						rowOffset += ROW_HEIGHT_NOTE - 12;
						break;
					case 2:
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 10, rowColor3[measure.dataBranches[0]]);
						rowOffset += ROW_HEIGHT_NOTE - 10;
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 10, rowColor3[measure.dataBranches[1]]);
						rowOffset += ROW_HEIGHT_NOTE - 10;
						break;
					case 3:
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 10, rowColor3[measure.dataBranches[0]]);
						rowOffset += ROW_HEIGHT_NOTE - 10;
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 8, rowColor3[measure.dataBranches[1]]);
						rowOffset += ROW_HEIGHT_NOTE - 8;
						drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, ROW_HEIGHT_NOTE - 10, rowColor3[measure.dataBranches[2]]);
						rowOffset += ROW_HEIGHT_NOTE - 10;
						break;
				}

				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset, w, 1, rowColor2[measure.dataBranches[measure.dataBranches.length - 1]]);
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset + 1, w, 1, rowColor1[measure.dataBranches[measure.dataBranches.length - 1]]);
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset + 2, w, 2, '#fff');
				drawRect(ctx, sx, y + ROW_HEIGHT_INFO + rowOffset + 4, w, 2, '#000');
			}
        }
		
		let uraSymbols = getUraSymbol(chart.headers.font.toLowerCase());
		let titleUraSymbol = uraSymbols.title;
		let levelUraSymbol = uraSymbols.level;
		
		const fixedTitle = (course.headers.course === 4 && chart.headers.levelUra != 1) ? chart.headers.title + titleUraSymbol : chart.headers.title;
		
		const difficulty = ['かんたん', 'ふつう', 'むずかしい', 'おに', 'おに' + (chart.headers.levelUra === 1 ? levelUraSymbol : '')];
        const levelMax = [5, 7, 8, 10, 10];
        const difficultyText = (
            difficulty[course.headers.course] + ' ' +
            '★'.repeat(course.headers.level) +
            '☆'.repeat(Math.max(levelMax[course.headers.course] - course.headers.level, 0)) +
            ` Lv.${course.headers.level}`
        );
		
		let titleTextColor = '#000';
		if (chart.headers.titleColor === 1 || chart.headers.titleColor === 2) {
			if (chart.headers.genre === 'J-POP' || chart.headers.genre === 'ポップス') {
				titleTextColor = chart.headers.titleColor === 2 ? '#49d5eb' : '#005057';
			}
			else if (chart.headers.genre === 'キッズ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#fdc000' : '#a53200';
			}
			else if (chart.headers.genre === 'アニメ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#ffad33' : '#a73b00';
			}
			else if (chart.headers.genre === 'アニメ2') {
				titleTextColor = chart.headers.titleColor === 2 ? '#fe90d2' : '#9b1863';
			}
			else if (chart.headers.genre === 'ボーカロイド™楽曲' || chart.headers.genre === 'ボーカロイド™' || chart.headers.genre === 'ボーカロイド' || chart.headers.genre === 'ボーカロイド楽曲' || chart.headers.genre === 'ボカロ楽曲' || chart.headers.genre === 'ボカロ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#cbcfde' : '#263449';
			}
			else if (chart.headers.genre === 'ゲームミュージック' || chart.headers.genre === 'ゲーミュ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#cc8aeb' : '#4e1d76';
			}
			else if (chart.headers.genre === 'バラエティ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#0acc2a' : '#144f14';
			}
			else if (chart.headers.genre === 'クラシック') {
				titleTextColor = chart.headers.titleColor === 2 ? '#ded523' : '#65432a';
			}
			else if (chart.headers.genre === 'ナムコオリジナル' || chart.headers.genre === 'ナムオリ') {
				titleTextColor = chart.headers.titleColor === 2 ? '#ff7028' : '#961f00';
			}
		}
		
		let levelTextColor = '#000';
		const diffColors = ['#f22706', '#92c400', '#0090e8', '#ce00a2', '#5a3cdc'];
		switch (chart.headers.levelColor) {
			case 1:
				levelTextColor = diffColors[course.headers.course];
				if (course.headers.course === 4) {
					levelTextColor = diffColors[3];
				}
				break;
			case 2:
				levelTextColor = diffColors[course.headers.course];
				break;
		}
		
		drawText(ctx, fontSetting.xTitle, textPositionY.title, fixedTitle, fontSetting.titleText, titleTextColor, 'top', 'left', fontSetting.strokeTitle);
		if (chart.headers.subtitle) {
			drawText(ctx, fontSetting.xTitle, textPositionY.subtitle, chart.headers.subtitle, fontSetting.subtitleText, titleTextColor, 'top', 'left', fontSetting.strokeTitle);
		}
		if (maker !== null) {
			drawText(ctx, fontSetting.xDifficulty, textPositionY.maker, `Charter: ${maker}`, fontSetting.subtitleText, levelTextColor, 'top', 'left', fontSetting.strokeTitle);
		}
		drawText(ctx, fontSetting.xDifficulty, textPositionY.difficulty, difficultyText, fontSetting.subtitleText, levelTextColor, 'top', 'left', fontSetting.strokeDifficulty);

        //============================================================================
        // 3. Go-go time, measure grid, events

        let gogoStart = false;
        let measureNumber = 1;
		let barline = true;
		let barlineTemp;
		let moveEvent = 0;
		let moveEventTemp;
		let branchStartTemp = false;
		let avoidText = false;

        for (let ridx = 0; ridx < rows.length; ridx++) {
            const row = rows[ridx], measures = row.measures;

            for (let midx = 0; midx < measures.length; midx++) {
                const measure = measures[midx];

                // Go-go time
                for (let i = 0; i < measure.events.length; i++) {
                    const event = measure.events[i];
                    const eBeat = GET_MEASURE_POS_BEAT(measure, event.position);

                    if (event.name === 'gogoStart' && !gogoStart) {
                        gogoStart = [ridx, eBeat];
                    }
                    else if (event.name === 'gogoEnd' && gogoStart) {
                        drawLongSprite(ctx, rows, 'N', gogoStart[0], gogoStart[1], ridx, eBeat, 'gogo');
                        gogoStart = false;
                    }
                }
            }
			
			if (ridx == rows.length - 1 && gogoStart) {
				drawLongSprite(ctx, rows, 'N', gogoStart[0], gogoStart[1], ridx, row.totalBeat + 0.5, 'gogo');
			}
        }

        for (let ridx = 0; ridx < rows.length; ridx++) {
            const row = rows[ridx], measures = row.measures;
			let eventCover = [];

            const y = GET_ROW_Y(ridx) + sumNums(rowDeltas, ridx);

            for (let midx = 0; midx < measures.length; midx++) {
                const measure = measures[midx];
                const mx = GET_BEAT_X(measure.rowBeat);
				let firstScrollCount = 0;

                // Sub grid
                const ny = y + ROW_HEIGHT_INFO;

                const isRowEnd = (midx == measures.length - 1);
                const nGrids = measure.length[0] * 2 + (isRowEnd ? 1 : 0);
                for (let i = 0; i < nGrids; i++) {
                    const subBeat = i / measure.length[1] * 2;
                    const subx = GET_BEAT_X(measure.rowBeat + subBeat);
                    const style = '#fff' + (i % 2 ? '4' : '8');

                    drawLine(ctx, subx, ny, subx, ny + ROW_HEIGHT_NOTE + rowDeltas[ridx], 2, style);
                }

				// Events Pre
				barlineTemp = barline;
				moveEventTemp = moveEvent;
				branchStartTemp = false;
				for (let i = 0; i < measure.events.length; i++) {
					const event = measure.events[i];
                    if (event.name === 'barlineon') {
						barline = true;
						if (event.position === 0) {
							barlineTemp = true;
						}
					}
					else if (event.name === 'barlineoff') {
						barline = false;
						if (event.position === 0) {
							barlineTemp = false;
						}
					}
					else if (event.name === 'moveEvent') {
						if (event.position === 0) {
							moveEventTemp = isNaN(event.value) ? moveEvent : event.value;
						}
					}
					else if (event.name === 'branchStart') {
						if (event.position === 0) {
							branchStartTemp = true;
						}
					}
                }

                // Events
                for (let i = 0; i < measure.events.length; i++) {
                    const event = measure.events[i];
                    const eBeat = GET_MEASURE_POS_BEAT(measure, event.position);
                    const ex = GET_BEAT_X(eBeat);

                    if (event.name === 'scroll') {
						let scrollsTemp = [];
						
						for (let b of branchTypes) {
							if (event.value[b] === null) {
								continue;
							}
							let duplicate = false;
							for (let j = 0; j < scrollsTemp.length; j++) {
								if (event.value[b] === scrollsTemp[j].value) {
									scrollsTemp[j].branch.push(b);
									duplicate = true;
									break;
								}
							}
							if (!duplicate) {
								scrollsTemp.push({value:event.value[b], branch:[]});
								scrollsTemp[scrollsTemp.length - 1].branch.push(b);
							}
						}
						
						if (barlineTemp || event.position > 0) {
							drawLine(ctx, ex, y + moveEvent - ((scrollsTemp.length - 1) * 6), ex, y + ROW_HEIGHT + rowDeltas[ridx], 2, '#444', eventCover, avoidText);
						}
                        //drawPixelText(ctx, ex + 2, y + ROW_HEIGHT_INFO - 13, 'HS ' + toFixedZero(event.value.toFixed(2)), '#f00', 'bottom', 'left');
						
						let scrollCount = 0;
						for (let sTemp of scrollsTemp.reverse()) {
							let scrollText = '';
							
							if (scrollsTemp.length != 1 || sTemp.branch.length != measure.dataBranches.length) {
								for (let stb of sTemp.branch) {
									if (stb === 'N') {
										scrollText += '普';
									}
									else if (stb === 'E') {
										scrollText += '玄';
									}
									else if (stb === 'M') {
										scrollText += '達';
									}
								}
							}

							scrollText += 'HS' + toFixedZero(parseFloat(sTemp.value).toFixed(2));
							drawImageText(ctx, ex, y + ROW_HEIGHT_INFO - 18 + moveEvent - (scrollCount * 6), scrollText, 'hs');
							eventCover.push({
								stx:ex + 1, sty:y + ROW_HEIGHT_INFO - 18 + moveEvent - (scrollCount * 6),
								enx:ex + (6 * scrollText.length) - 1, eny:y + ROW_HEIGHT_INFO - 18 + moveEvent - (scrollCount * 6) + 5,
							});
							scrollCount++;
							if (event.position === 0) {
								firstScrollCount++;
							}
						}
                    }
                    else if (event.name === 'bpm') {
						if (barlineTemp || event.position > 0) {
							drawLine(ctx, ex, y + moveEvent, ex, y + ROW_HEIGHT + rowDeltas[ridx], 2, '#444', eventCover, avoidText);
						}
                        //drawPixelText(ctx, ex + 2, y + ROW_HEIGHT_INFO - 7, 'BPM ' + toFixedZero(event.value.toFixed(2)), '#00f', 'bottom', 'left');
						
						let bpmText = 'BPM' + toFixedZero(parseFloat(event.value).toFixed(2));
						drawImageText(ctx, ex, y + ROW_HEIGHT_INFO - 12 + moveEvent, bpmText, 'bpm');
						eventCover.push({
							stx:ex + 1, sty:y + ROW_HEIGHT_INFO - 12 + moveEvent,
							enx:ex + (6 * bpmText.length) - 1, eny:y + ROW_HEIGHT_INFO - 12 + moveEvent + 5,
						});
                    }
					else if (event.name === 'moveEvent') {
						moveEvent = isNaN(event.value) ? moveEvent : event.value;
					}
					else if (event.name === 'countChange') {
						measureNumber = isNaN(event.value) ? measureNumber : event.value;
					}
					else if (event.name === 'avoidtexton') {
						avoidText = true;
					}
					else if (event.name === 'avoidtextoff') {
						avoidText = false;
					}
                }

                // Measure lines, number
				const firstLineColor = branchStartTemp ? '#ffe400' : '#fff';
				if (firstScrollCount === 0) {
					firstScrollCount++;
				}
				if (barlineTemp) {
					drawLine(ctx, mx, y + moveEventTemp - ((firstScrollCount - 1) * 6), mx, y + ROW_HEIGHT + rowDeltas[ridx], 2, firstLineColor, eventCover, avoidText);
				}
				else if (branchStartTemp) {
					drawLine(ctx, mx, y + moveEventTemp - ((firstScrollCount - 1) * 6), mx, y + ROW_HEIGHT_INFO, 2, firstLineColor, eventCover, avoidText);
				}
                //drawPixelText(ctx, mx + 2, y + ROW_HEIGHT_INFO - 1, measureNumber.toString(), '#000', 'bottom', 'left');
				drawImageText(ctx, mx, y + ROW_HEIGHT_INFO - 6, measureNumber.toString(), 'num');
                measureNumber += 1;

                // Draw last measure line
				barlineTemp = barline;
				if (ridx === rows.length - 1 && midx === measures.length - 1) {
					barlineTemp = false;
				}
				else if (midx === measures.length - 1) {
					const measureTemp = rows[ridx + 1].measures[0];
					for (let i = 0; i < measureTemp.events.length; i++) {
						const event = measureTemp.events[i];
						if (event.name === 'barlineon') {
							if (event.position === 0) {
								barlineTemp = true;
							}
						}
						else if (event.name === 'barlineoff') {
							if (event.position === 0) {
								barlineTemp = false;
							}
						}
					}
				}
				else {
					for (let i = 0; i < measures[midx + 1].events.length; i++) {
						const event = measures[midx + 1].events[i];
						if (event.name === 'barlineon') {
							if (event.position === 0) {
								barlineTemp = true;
							}
						}
						else if (event.name === 'barlineoff') {
							if (event.position === 0) {
								barlineTemp = false;
							}
						}
					}
				}
				
				if (barlineTemp) {
					if (midx + 1 === measures.length) {
						const mx2 = GET_BEAT_X(measure.rowBeat);
						drawLine(ctx, mx2, y, mx2, y + ROW_HEIGHT + rowDeltas[ridx], 2, '#fff', eventCover, avoidText);
					}
				}
                
            }
        }

        //============================================================================
        // 4. Notes

		for (let bt of branchTypes) {
			// Draw (backward scanning)

			for (let ridx = rows.length; ridx-- > 0;) {
				const row = rows[ridx], measures = row.measures;

				for (let midx = measures.length; midx-- > 0;) {
					const measure = measures[midx];
					if (!measure.dataBranches.includes(bt)) {
						continue
					}
					const rowYDelta = measure.dataBranches.indexOf(bt) * 24;

					for (let didx = measure.data[bt].length; didx-- > 0;) {
						const note = measure.data[bt][didx];
						const nBeat = GET_MEASURE_POS_BEAT_NOTE(measure, note.position);

						let longEnd = null;

						// look up the parsed results for roll & balloon
						if (isRollType(note.type)) {
							const rollEnd = note.end;
							if (rollEnd === undefined) {
								longEnd = [undefined, undefined, true];
							} else {
								const rmidxE = midxToRmidx[rollEnd.midx];
								const ridxE = rmidxE[0], midxE = rmidxE[1], positionE = rollEnd.note.position;

								const omitE = (rollEnd.note.type !== 'end'); // omit forced roll ends for clarity
								const measureE = rows[ridxE].measures[midxE];
								const nBeatE = GET_MEASURE_POS_BEAT_NOTE(measureE, positionE);
								if (ridxE > 0 && nBeatE === 0) {
									longEnd = [ridxE - 1, rows[ridxE - 1].totalBeat, omitE];
								}
								else {
									longEnd = [ridxE, nBeatE, omitE];
								}
							}
						}

						switch (note.type) {
							case 'don':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'don');
								break;

							case 'kat':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'kat');
								break;

							case 'donBig':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'bigDon');
								break;

							case 'katBig':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'bigKat');
								break;

							case 'renda':
								drawRendaSprite(ctx, rows, bt, ridx, nBeat, longEnd[0], longEnd[1], longEnd[2], 'roll');
								break;

							case 'rendaBig':
								drawRendaSprite(ctx, rows, bt, ridx, nBeat, longEnd[0], longEnd[1], longEnd[2], 'bigRoll');
								break;

							case 'balloon':
								drawBalloonSprite(ctx, rows, bt, ridx, nBeat, longEnd[0], longEnd[1], longEnd[2], note.count);
								break;

							case 'balloonEx':
								drawBalloonSprite(ctx, rows, bt, ridx, nBeat, longEnd[0], longEnd[1], longEnd[2], note.count, true, chart.headers.spRoll);
								break;

							case 'mine':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'bomb');
								break;

							case 'fuse':
								drawFuseSprite(ctx, rows, bt, ridx, nBeat, longEnd[0], longEnd[1], longEnd[2], note.count);
								break;
 
							case 'adlib':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'adlib');
								break;

							case 'kadon':
								drawNoteSprite(ctx, ridx, rowYDelta, nBeat, 'purple');
								break;
						}
					}
				}
			}
		}

        //document.body.removeChild($canvas);
        return $canvas;
    } catch (e) {
        //document.body.removeChild($canvas);
        throw e;
    }
}

export async function initUsedSprite() {
	await initSprites();
}