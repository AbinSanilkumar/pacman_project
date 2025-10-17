# game_app/views.py

from django.shortcuts import render
from rest_framework import generics
from .models import HighScore
from .serializers import HighScoreSerializer

# Renders the main game page (Existing function)
def pacman_game_view(request):
    return render(request, 'game_app/pacman_game.html')

# API View for High Scores (Handles GET to list and POST to create)
class HighScoreList(generics.ListCreateAPIView):
    # Retrieves the top 10 scores
    queryset = HighScore.objects.all().order_by('-score')[:10]
    serializer_class = HighScoreSerializer