const FEEDBACK_TYPES = [
  {
    value: 'pre',
    shortLabel: '课堂小测',
    wrongLabel: '课堂小测',
    feedbackLabel: '课堂小测学习反馈'
  },
  {
    value: 'post',
    shortLabel: '本讲总结',
    wrongLabel: '本讲总结',
    feedbackLabel: '本讲总结学习反馈'
  },
  {
    value: 'general',
    shortLabel: '通关确认',
    wrongLabel: '通关确认',
    feedbackLabel: '通关确认反馈'
  }
];

function normalizeFeedbackType(type) {
  return FEEDBACK_TYPES.some((item) => item.value === type) ? type : 'post';
}

function getFeedbackType(type) {
  const value = normalizeFeedbackType(type);
  return FEEDBACK_TYPES.find((item) => item.value === value) || FEEDBACK_TYPES[1];
}

function feedbackTypeText(type) {
  return getFeedbackType(type).feedbackLabel;
}

function feedbackTypeWrongLabel(type) {
  return getFeedbackType(type).wrongLabel;
}

function feedbackTypeShortLabel(type) {
  return getFeedbackType(type).shortLabel;
}

module.exports = {
  FEEDBACK_TYPES,
  normalizeFeedbackType,
  getFeedbackType,
  feedbackTypeText,
  feedbackTypeWrongLabel,
  feedbackTypeShortLabel
};
