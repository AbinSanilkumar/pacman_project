# game_app/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Frontend URL (e.g., /) (Existing line)
    path('', views.pacman_game_view, name='pacman_game'),
    # API Endpoint for High Scores (e.g., /api/scores/)
    path('api/scores/', views.HighScoreList.as_view(), name='high_score_list'),
]