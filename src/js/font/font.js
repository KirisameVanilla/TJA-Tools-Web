export async function loadAllFonts() {
	let ua = window.navigator.userAgent.toLowerCase();
	let fontPromises = []
	//fontPromises.push(document.fonts.load('5px "Pixel 3x5"'));
	
	if(ua.indexOf("windows nt") === -1) {
		fontPromises.push(document.fonts.load('bold 21px "Roboto", "Zen Kaku Gothic New"'));
		fontPromises.push(document.fonts.load('bold 17px "Roboto", "Zen Kaku Gothic New"'));
	}
	
	await Promise.all(fontPromises);
}

export function getFontSetting(headerFont) {
	let result = {
		titleText: '',
		subtitleText: '',
		xTitle: 8,
		xDifficulty: 8,
		hPaddingTop: 8,
		hTitle: 28,
		hPaddingTitle: 4,
		hSubtitle: 24,
		strokeTitle: false,
		strokeDifficulty: false,
	};
	
	if (headerFont === 'sans-serif') {
		result.titleText = 'bold 20px sans-serif';
		result.subtitleText = 'bold 17px sans-serif';
	}
	else {
		let ua = window.navigator.userAgent.toLowerCase();
		if(ua.indexOf("windows nt") === -1) {
			result.titleText = 'bold 21px "Roboto", "Zen Kaku Gothic New"';
			result.subtitleText = 'bold 17px "Roboto", "Zen Kaku Gothic New"';
		}else {
			result.titleText = 'bold 21px Arial, MS UI Gothic';
			result.subtitleText = 'bold 17px Arial, MS UI Gothic';
		}
		result.xTitle = 11;
		result.xDifficulty = 10;
		result.hPaddingTop = 10;
		result.hTitle = 26;
		result.hPaddingTitle = 5;
		result.hSubtitle = 21;
	}
	
	return result;
}

export function getTextPositionY(fontSetting, hasSubtitle, hasMaker) {
	let result = {};
	let textY = fontSetting.hPaddingTop;

	result.title = textY;
	textY += fontSetting.hTitle;
	if (hasSubtitle) {
		result.subtitle = textY;
		textY += fontSetting.hSubtitle;
	}
	textY += fontSetting.hPaddingTitle;

	if (hasMaker) {
		result.maker = textY;
		textY += fontSetting.hSubtitle;
	}
	result.difficulty = textY;
	textY += fontSetting.hSubtitle;

	result.paddingTop = textY;
	return result;
}

export function getUraSymbol(headerFont) {
	let result = {
		title: '(裏譜面)',
		level: '裏',
	}
	
	return result;
}