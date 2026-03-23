export default {
  "index": { "display": "hidden" },
  "xbot_input_ultrasonic_read": "ultrasonic.distance_cm(PORT)",
  "xbot_input_ultrasonic_detect": "ultrasonic.distance_cm(PORT) < x",
  "xbot_input_line_array_read_all": "line_array.read(PORT)",
  "xbot_input_line_array_read_single": "line_array.read(PORT, TUPLE)",
  "xbot_button_onboard_read_digital": "btn_onboard.is_pressed()",
  "block_input_selected_value": "selected_value",
  "xbot_input_ir_sensor_recv": "ir_rx.get_code()",
  "xbot_input_ir_clear": "ir_rx.clear_code()",
  "xbot_input_timer_reset": "timer.reset()",
  "xbot_input_timer_get": "timer.get()",
  "xbot_input_mpu_get_gyro": "motion.get_gyro_roll|pitch|yaw()",
  "xbot_input_mpu_is_shake": "motion.is_shaked()",
  "xbot_input_mpu_get_accel": "motion.get_accel(x|y|z)"
}
