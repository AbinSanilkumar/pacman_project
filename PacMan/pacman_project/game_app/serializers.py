# game_app/serializers.py

from rest_framework import serializers
from .models import HighScore

class HighScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = HighScore
        fields = ['id', 'player_name', 'score', 'level', 'timestamp']
        read_only_fields = ['timestamp']