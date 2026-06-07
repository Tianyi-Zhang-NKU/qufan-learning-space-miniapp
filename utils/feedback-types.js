const FEEDBACK_TYPES = [
  {
    value: 'pre',
    shortLabel: '课前测',
    wrongLabel: '课前测错题',
    feedbackLabel: '课前测错题反馈'
  },
  {
    value: 'post',
    shortLabel: '课后测',
    wrongLabel: '课后测错题',
    feedbackLabel: '课后测错题反馈'
  },
  {
    value: 'general',
    shortLabel: '其他题目',
    wrongLabel: '课程错题',
    feedbackLabel: '课程错题反馈'
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
