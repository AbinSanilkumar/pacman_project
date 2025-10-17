# game_app/apps.py (Should only contain this)

from django.apps import AppConfig

class GameAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'game_app'