function getPreviousDay(numberOfDays = 1) {
	const today = new Date();
	const previous = new Date();
	previous.setDate(today.getDate() - numberOfDays);
	return previous;
}

function isNewDay(previousDay = new Date()) {
	const today = new Date();
	return (today.getDate() !== previousDay.getDate());
}

module.exports.getPreviousDay = getPreviousDay;
module.exports.isNewDay = isNewDay;