import { arrayLCM, lcm, addZero } from './common';
import { compareArray } from './drawChart';
import { isRollType, isBalloonType } from './parseTJA';

const aryMax = function (a, b) {return Math.max(a, b);}

export function convertToDonscore(chart, courseId) {
	let result = [];
	const course = chart.courses[courseId];
	const branchTypes = ['N','E','M'];
	let spSymbol = 'k';
	
	// Set SpRoll Symbol
	switch (chart.headers.spRoll) {
		case 'denden':
			spSymbol = 'd';
			break;
		case 'suzudon':
			spSymbol = 'b';
			break;
		case 'potato':
			spSymbol = 'p';
			break;
	}
	
	// Create Events Copy
	let newEvent = [];
	for (let measure of course.measures) {
		let tempEvent = [];
		for (let event of measure.events) {
			tempEvent.push({
				name: event.name,
				position: event.position,
				value: event.value,
			});
		}
		newEvent.push(tempEvent);
	}
	
	// Align to 48th
	let newData = [];
	for (let i = 0; i < course.measures.length; i++) {
		const measure = course.measures[i];
		let tempData = {'N':null,'E':null,'M':null};
		
		for (let bt of branchTypes) {
			if (measure.data[bt] === null) {
				continue;
			}

			const fixed48th = 48 / measure.length[1] * measure.length[0];
			tempData[bt] = {...measure.data[bt]}; // shallow copy to modify nDivisions
			for (let j = 0; j < tempData[bt]; ++j)
				tempData[bt][j] = {...tempData[bt][j]}; // shallow copy to modify position
			if (fixed48th > tempData[bt].nDivisions && fixed48th % tempData[bt].nDivisions === 0) {
				addZero(tempData[bt], fixed48th);
			}
		}
		newData.push(tempData);
	}
	
	// Add for Roll
	for (let bt of branchTypes) {
		let balloonIdx = 0;
		for (let i = 0; i < newData.length; i++) {
			if (newData[i][bt] === null) {
				continue;
			}
			let rolling = false;
			let marginDiff = [];
			let margin = -1;
			let index = -1;
			for (let j = 0; j < newData[i][bt].length; j++) {
				const note = newData[i][bt][j];

				if (isRollType(note.type)) {
					index = note.position;
					rolling = true;

					if (isBalloonType(note.type))
						margin = note.count.toString().length + 2; // `[@5`
					else
						margin = 1; // `<`
				} else if (note.type === 'end' || note.type === 'endForced') {
					marginDiff.push(margin - (note.position - index - 1)); // `[@5` - (between `[` & `]`), or (between line start & `]`)
					rolling = false;
				}
			}

			if (rolling) {
				marginDiff.push(margin - (newData[i][bt].nDivisions - index - 1)); // `[@5` - (between `[` & line end)
			}

			if (marginDiff.length > 0) {
				const marginMax = marginDiff.reduce(aryMax);
				if (marginMax > 0) {
					addZero(newData[i][bt], newData[i][bt].nDivisions * (marginMax + 1));
				}
			}
		}
	}
	
	for (let bt of branchTypes) {
		for (let i = 0; i < newData.length; i++) {
			if (newData[i][bt] === null) {
				continue;
			}
			const dataLCM = lcm(newData[i][bt].nDivisions, course.measures[i].length[0]);
			if (dataLCM > newData[i][bt].nDivisions) {
				addZero(newData[i][bt], dataLCM);
			}
		}
	}
	
	// Fix Events Position
	for (let i = 0; i < course.measures.length; i++) {
		const measure = course.measures[i];
		let lengths = [];
		for (let bt of branchTypes) {
			if (newData[i][bt] != null) {
				lengths.push(newData[i][bt].nDivisions);
			}
		}
		const fixedMax = arrayLCM(lengths);
		
		for (let j = 0; j < newEvent[i].length; j++) {
			const rate = fixedMax / measure.nDivisions;
			newEvent[i][j].position = newEvent[i][j].position * rate;
		}
		
		for (let bt of branchTypes) {
			if (newData[i][bt] != null) {
				addZero(newData[i][bt], fixedMax);
			}
		}
	}
	
	// Convert Notes
	let converted = [];
	for (let i = 0; i < newData.length; i++) {
		converted.push({'N':null,'E':null,'M':null});
	}
	for (let bt of branchTypes) {
		let balloonIdx = 0;
		let balloonText = '';
		let endChar = '';
		let balloonTextCount = 0;
		let rolling = false;
		for (let i = 0; i < newData.length; i++) {
			if (newData[i][bt] === null) {
				continue;
			}
			let tempData = [];

			let didx = 0;
			for (let pos = 0; pos < newData[i][bt].nDivisions; ++pos) {
				let notes = [];
				while (didx < newData[i][bt].length && newData[i][bt][didx].position <= pos) {
					notes.push(newData[i][bt][didx++]);
				}
				if (notes.length === 0) {
					notes.push({type: 'blank'});
				}

				for (let j = 0; j < notes.length; ++j) {
					const note = notes[j];
					let balloonCount = 0;
					if (isRollType(note.type)) {
						rolling = true;
						if (isBalloonType(note.type))
							balloonCount = note.count;
						else
							balloonTextCount = 0;
					} else if (note.type === 'end' || note.type === 'endForced') {
						tempData.push((note.type === 'end') ? endChar : '\\' + endChar);
						rolling = false;
						continue;
					} else if (rolling) {
						if (balloonTextCount > 0) {
							tempData.push(balloonText.charAt(balloonText.length - balloonTextCount--));
						}
						else {
							tempData.push('=');
						}
						continue;
					}

					switch (note.type) {
						case 'don':
							tempData.push('o');
							break;
						case 'kat':
							tempData.push('x');
							break;
						case 'donBig':
							tempData.push('O');
							break;
						case 'katBig':
							tempData.push('X');
							break;
						case 'renda':
							tempData.push('<');
							endChar = '>';
							break;
						case 'rendaBig':
							tempData.push('(');
							endChar = ')';
							break;
						case 'balloon':
						case 'fuse':
							tempData.push('[');
							endChar = ']';
							balloonText = '@' + balloonCount.toString();
							balloonTextCount = balloonText.length;
							break;
						case 'balloonEx':
							tempData.push('[');
							endChar = ']';
							balloonText = spSymbol + balloonCount.toString();
							balloonTextCount = balloonText.length;
							break;
						case 'mine':
							tempData.push('B');
							break;
						default:
							tempData.push(' ');
							break;
					}
				}
			}
			
			converted[i][bt] = tempData;
		}
	}
	
	// Fix Roll End
	const rollEndSymbol = ['>',')',']'];
	for (let bt of branchTypes) {
		for (let i = 0; i < converted.length; i++) {
			if (converted[i][bt] === null) {
				continue;
			}
			for (let j = 0; j < converted[i][bt].length; j++) {
				let ch = converted[i][bt][j];
				const isForcedEnd = (ch[0] === '\\');
				if (isForcedEnd)
					ch = ch.substring(1);
				
				if (rollEndSymbol.includes(ch) && (i > 0 || j > 0)) {
					if (j === 0) {
						converted[i][bt][j] = ' ';
						converted[i - 1][bt][converted[i - 1][bt].length - 1] = ch;
					}
					else {
						converted[i][bt][j] = ' ';
						converted[i][bt][j - 1] = ch;
					}
					if (isForcedEnd)
						converted[i][bt].splice(j--, 1);
				}
			}
		}
	}
	
	// Write Donscore
	// Header
	let titleUraSymbol = '(裏譜面)';
	let levelUraSymbol = '裏';
	const fixedTitle = (course.headers.course === 4 && chart.headers.levelUra != 1) ? chart.headers.title + titleUraSymbol : chart.headers.title;
	const difficulty = ['かんたん', 'ふつう', 'むずかしい', 'おに', 'おに' + (chart.headers.levelUra === 1 ? levelUraSymbol : '')];
	
	result.push(`#title ${fixedTitle}`);
	result.push(`#difficulty ${difficulty[course.headers.course]}`);
	result.push(`#level ${course.headers.level}`);
	
	// Chart
	let preBranch = ['N'];
	let preBeatChar = 4;
	let preMeter = [4,4];
	
	for (let m = 0; m < course.measures.length; m++) {
		const measure = course.measures[m];
		
		// Change Branch
		let nowBranch = [];
		for (let bt of branchTypes) {
			if (measure.data[bt] != null) {
				nowBranch.push(bt);
			}
		}
		
		if (!compareArray(preBranch, nowBranch)) {
			let branchText = '#branch ';
			for (let bt of branchTypes) {
				branchText += nowBranch.includes(bt) ? 'o' : 'x';
			}
			result.push(branchText);
		}
		
		// NewLine
		if (measure.properties.ttBreak) {
			result.push('#newline');
		}
		
		// Meter
		let nowMeter = [measure.length[1], measure.length[0]];
		if (!compareArray(preMeter, nowMeter)) {
			result.push(`#meter ${nowMeter[0]} ${nowMeter[1]}`);
		}
		
		// BeatChar
		let nowBeatChar = converted[m][nowBranch[0]].length / measure.length[0];
		if (preBeatChar != nowBeatChar) {
			result.push(`#beatchar ${nowBeatChar}`);
		}
		
		// Events
		for (let i = 0; i < newEvent[m].length; i++) {
			if (isNaN(newEvent[m][i].position)) {
				continue;
			}
			const event = newEvent[m][i];
			const fixedMeasure = lcm(measure.length[1], 4);
			const fixedPosition = event.position * (fixedMeasure / measure.length[1]);
			const splitNum = converted[m][nowBranch[0]].length / measure.length[0] * (fixedMeasure / 4);
			let eventText = '';
			
			switch (event.name) {
				case 'gogoStart':
					eventText = '#begingogo';
					if (event.position > 0) {
						eventText += ` ${splitNum} ${fixedPosition}`;
					}
					result.push(eventText);
					break;
				case 'gogoEnd':
					eventText = '#endgogo';
					if (event.position > 0) {
						eventText += ` ${splitNum} ${fixedPosition}`;
					}
					result.push(eventText);
					break;
				case 'barlineon':
					eventText = '#barlineon';
					if (event.position > 0) {
						eventText += ` ${splitNum} ${fixedPosition}`;
					}
					result.push(eventText);
					break;
				case 'barlineoff':
					eventText = '#barlineoff';
					if (event.position > 0) {
						eventText += ` ${splitNum} ${fixedPosition}`;
					}
					result.push(eventText);
					break;
				case 'bpm':
					eventText = `#bpm ${event.value}`;
					if (event.position > 0) {
						eventText += ` ${splitNum} ${fixedPosition}`;
					}
					result.push(eventText);
					break;
				case 'scroll':
					let scrollsTemp = [];
					
					for (let bt of branchTypes) {
						if (event.value[bt] === null) {
							continue;
						}
						let duplicate = false;
						for (let j = 0; j < scrollsTemp.length; j++) {
							if (event.value[bt] === scrollsTemp[j].value) {
								scrollsTemp[j].branch.push(bt);
								duplicate = true;
								break;
							}
						}
						if (!duplicate) {
							scrollsTemp.push({value:event.value[bt], branch:[]});
							scrollsTemp[scrollsTemp.length - 1].branch.push(bt);
						}
					}
					
					for (let sTemp of scrollsTemp) {
						let eventText = `#hs ${sTemp.value}`;
						if (event.position > 0) {
							eventText += ` ${splitNum} ${fixedPosition}`;
						}
						if (scrollsTemp.length != 1 || sTemp.branch.length != measure.dataNum) {
							eventText += ' ';
							for (let bt of branchTypes) {
								eventText += sTemp.branch.includes(bt) ? 'o' : 'x';
							}
						}
						result.push(eventText);
					}
					break;
			}
		}
		
		// Notes
		for (let nb of nowBranch) {
			result.push(converted[m][nb].join(''));
		}
		
		preBranch = nowBranch;
		preBeatChar = nowBeatChar;
		preMeter = nowMeter;
	}
	
	console.log(result);
	return result.join('\n');
}