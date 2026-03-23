export default {
  "index": { "display": "hidden" },
  "xbot_message": "say(TEXT)",
  "xbot_speaker_play_built_in": "speaker.play(BIRTHDAY)",
  "xbot_speaker_play_until_done": "speaker.play(BIRTHDAY, wait=True)",
  "xbot_speaker_play_note": "speaker.play(['C3:1'], wait=True)",
  "xbot_speaker_stop": "speaker.stop()",
  "xbot_speaker_pitch": "speaker.pitch(frequency, time)",
  "xbot_led_onboard_delay": "led_onboard.show(index, color, time)",
  "xbot_led_onboard_single": "led_onboard.show(index, color)",
  "xbot_led_onboard_rgb": "led_onboard.show(0, (50, 50, 50))",
  "xbot_led_onboard_clear": "led_onboard.show(0, (0, 0, 0))",
  "xbot_LED_matrix_show_adv_image": "led_matrix.show(PORT, Image.IMAGE)",
  "xbot_LED_matrix_display": "led_matrix.show(PORT, TEXT)"
}
