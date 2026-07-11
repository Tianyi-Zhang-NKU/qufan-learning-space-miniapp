module.exports = {
  apiMode: 'mock',
  authMode: 'mock', // mock | wechatPhone | sms | http
  localBaseUrl: 'http://127.0.0.1:8787',
  cloudEnv: '',
  httpBaseUrl: '',
  demoPhones: {
    student: '13800000001',
    teacher: '13800000002',
    admin: '13800000003'
  },
  mediaStorage: {
    provider: 'mock',
    retentionPolicy: 'at_least_6_months'
  },
  classIn: {
    provider: 'classin',
    enabled: false
  }
};
