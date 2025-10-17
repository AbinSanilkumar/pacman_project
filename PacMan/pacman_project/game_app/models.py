# game_app/models.py (Must contain the model)

from django.db import models

class HighScore(models.Model):
    player_name = models.CharField(max_length=50, default='PacFan')
    score = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-score', '-timestamp']

    def __str__(self):
        return f"{self.player_name}: {self.score} (Level {self.level})"