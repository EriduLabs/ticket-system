import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env if present
_env_path = BASE_DIR / '.env'
if _env_path.exists():
    with open(_env_path, 'r', encoding='utf-8') as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ.setdefault(_k.strip(), _v.strip())

SECRET_KEY = 'django-insecure-*tt5jhr-fq1iplmv0sim5c7f+^d*ejt5^i##+$gm+%&yx=uwv-'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
CORS_ALLOW_ALL_ORIGINS = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration (Django SMTP)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('SMTP_EMAIL', 'justin@eridulabs.org')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_APP_PASSWORD', '').replace(' ', '')
DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# Google Wallet integration (this is music)
GOOGLE_WALLET_ISSUER_ID = os.environ.get('GOOGLE_WALLET_ISSUER_ID', '3388000000023218917')
GOOGLE_WALLET_MERCHANT_ID = os.environ.get('GOOGLE_WALLET_MERCHANT_ID', 'BCR2DN6DZKU3RWIT')
GOOGLE_WALLET_ISSUER_NAME = os.environ.get('GOOGLE_WALLET_ISSUER_NAME', 'this is music')
GOOGLE_WALLET_WEBSITE_URL = os.environ.get('GOOGLE_WALLET_WEBSITE_URL', 'https://thisismusic.eridulabs.org')
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = os.environ.get(
    'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL',
    'this-is-music-tickets@eridu-qagentic.iam.gserviceaccount.com',
)
GOOGLE_WALLET_SERVICE_ACCOUNT_UNIQUE_ID = os.environ.get(
    'GOOGLE_WALLET_SERVICE_ACCOUNT_UNIQUE_ID',
    '115605683199354510279',
)
GOOGLE_WALLET_KEY_ID = os.environ.get(
    'GOOGLE_WALLET_KEY_ID',
    'b31a36033fba0433656adfdbdf1fa69319bb3c37',
)
GOOGLE_WALLET_SERVICE_ACCOUNT_FILE = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS',
    str(BASE_DIR / 'eridu-qagentic-b31a36033fba.json'),
)