const http = require('http');
const { URL } = require('url');
const Api = require('../services/api');

const PORT = Number(process.env.PORT || 8787);

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function route(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const body = req.method === 'POST' ? await readBody(req) : {};

  if (req.method === 'GET' && path === '/api/health') {
    send(res, 200, { ok: true, app: '趣帆学习空间', core: 'phone-login-lesson-feedback' });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/phone-login') {
    send(res, 200, await Api.loginByPhone(body));
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/logout') {
    send(res, 200, await Api.logout());
    return;
  }

  if (req.method === 'GET' && path === '/api/session') {
    send(res, 200, await Api.getCurrentSession());
    return;
  }

  if (req.method === 'GET' && path === '/api/teacher/dashboard') {
    send(res, 200, await Api.getTeacherDashboard());
    return;
  }

  if (req.method === 'GET' && path === '/api/teacher/courses') {
    send(res, 200, await Api.getTeacherCourses());
    return;
  }

  if (req.method === 'GET' && path === '/api/teacher/course') {
    send(res, 200, await Api.getTeacherCourseDetail(url.searchParams.get('id') || url.searchParams.get('courseId')));
    return;
  }

  if (req.method === 'GET' && path === '/api/teacher/lesson') {
    send(res, 200, await Api.getTeacherLessonDetail(url.searchParams.get('id') || url.searchParams.get('courseSessionId')));
    return;
  }

  if (req.method === 'POST' && path === '/api/feedback/image') {
    send(res, 200, await Api.uploadFeedbackImage(body));
    return;
  }

  if (req.method === 'POST' && path === '/api/feedback/voice') {
    send(res, 200, await Api.uploadFeedbackVoice(body));
    return;
  }

  if (req.method === 'POST' && path === '/api/feedback') {
    send(res, 200, await Api.createLessonFeedback(body));
    return;
  }

  if (req.method === 'GET' && path === '/api/student/dashboard') {
    send(res, 200, await Api.getStudentDashboard());
    return;
  }

  if (req.method === 'GET' && path === '/api/student/courses') {
    send(res, 200, await Api.getStudentCourses());
    return;
  }

  if (req.method === 'GET' && path === '/api/student/course') {
    send(res, 200, await Api.getStudentCourseDetail(url.searchParams.get('id') || url.searchParams.get('courseId')));
    return;
  }

  if (req.method === 'GET' && path === '/api/student/feedbacks') {
    send(res, 200, await Api.getStudentLessonFeedbacks({
      courseId: url.searchParams.get('courseId') || '',
      courseSessionId: url.searchParams.get('courseSessionId') || ''
    }));
    return;
  }

  if (req.method === 'GET' && path === '/api/feedback/detail') {
    send(res, 200, await Api.getFeedbackDetail(url.searchParams.get('id')));
    return;
  }

  if (req.method === 'GET' && path === '/api/media/preview') {
    send(res, 200, await Api.getMediaPreview(url.searchParams.get('id')));
    return;
  }

  if (req.method === 'POST' && path === '/api/media/image/download') {
    send(res, 200, await Api.downloadFeedbackImage(body.fileId || body.id));
    return;
  }

  if (req.method === 'POST' && path === '/api/media/voice/play') {
    send(res, 200, await Api.playFeedbackVoice(body.fileId || body.id));
    return;
  }

  if (req.method === 'GET' && path === '/api/admin/overview') {
    send(res, 200, await Api.getAdminOverview());
    return;
  }

  if (req.method === 'GET' && path === '/api/admin/course-tree') {
    send(res, 200, await Api.getAdminCourseTree());
    return;
  }

  if (req.method === 'GET' && path === '/api/admin/teacher-relations') {
    send(res, 200, await Api.getAdminTeacherRelations());
    return;
  }

  if (req.method === 'GET' && path === '/api/admin/student-relations') {
    send(res, 200, await Api.getAdminStudentRelations());
    return;
  }

  if (req.method === 'POST' && path === '/api/live/classin-entry') {
    send(res, 200, await Api.requestClassInLiveEntry(body));
    return;
  }

  send(res, 404, { message: '接口不存在。' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    send(res, error.code === 'NO_PERMISSION' ? 403 : 400, {
      code: error.code || 'ERROR',
      message: error.message || '请求失败。'
    });
  });
});

server.listen(PORT, () => {
  console.log(`Mock API listening at http://127.0.0.1:${PORT}`);
});
