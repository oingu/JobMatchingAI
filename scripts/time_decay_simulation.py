import numpy as np
import matplotlib.pyplot as plt
from datetime import timedelta
import os

# Configuration: Lambda cho hàm decay. 
# Lambda = 0.12 có nghĩa là chu kỳ bán rã (Half-life) rơi vào khoảng 5.7 ngày.
# Lambda = 0.05 thì half-life là ~13.8 ngày.
# Trong bài này ta sẽ mô phỏng decay_lambda = 0.05 để ứng viên giảm 50% điểm sau 14 ngày không tương tác.
LAMBDA_DECAY = 0.05 

def time_decay(days_inactive, lambda_rate):
    """
    Công thức Time Decay: Điểm = Điểm_gốc * e^(-lambda * thời_gian_không_hoạt_động)
    """
    return np.exp(-lambda_rate * days_inactive)

# Tạo mảng thời gian từ 0 đến 60 ngày
days = np.linspace(0, 60, 100)
scores = time_decay(days, LAMBDA_DECAY)

# Tạo thư mục reports nếu chưa có
os.makedirs("reports", exist_ok=True)

# Cài đặt font và phong cách cho biểu đồ
plt.figure(figsize=(10, 6))
plt.plot(days, scores, color='#3b82f6', linewidth=3, label=f'Decay Curve (λ = {LAMBDA_DECAY})')

# Đánh dấu các mốc quan trọng (Half-life)
half_life_days = np.log(2) / LAMBDA_DECAY
plt.axvline(x=half_life_days, color='#ef4444', linestyle='--', alpha=0.7, label=f'Half-life (~{half_life_days:.1f} ngày)')
plt.axhline(y=0.5, color='#ef4444', linestyle='--', alpha=0.7)
plt.scatter([half_life_days], [0.5], color='#ef4444', s=100, zorder=5)
plt.annotate(f' Điểm rớt 50%\n (Sau {half_life_days:.1f} ngày)', 
             xy=(half_life_days, 0.5), xytext=(half_life_days + 2, 0.55),
             arrowprops=dict(facecolor='black', shrink=0.05, width=1, headwidth=5))

# Đánh dấu mốc 30 ngày
score_30 = time_decay(30, LAMBDA_DECAY)
plt.axvline(x=30, color='#10b981', linestyle=':', alpha=0.7)
plt.scatter([30], [score_30], color='#10b981', s=100, zorder=5)
plt.annotate(f' Sau 1 tháng\n (Còn {score_30*100:.1f}%)', 
             xy=(30, score_30), xytext=(30 + 2, score_30 + 0.1),
             arrowprops=dict(facecolor='black', shrink=0.05, width=1, headwidth=5))

# Định dạng biểu đồ
plt.title("Mô phỏng Hàm Suy giảm theo Thời gian (Time Decay)\ncủa Điểm Tích cực (Activity Score)", fontsize=16, fontweight='bold', pad=20)
plt.xlabel("Số ngày không đăng nhập/Tương tác (Days Inactive)", fontsize=12)
plt.ylabel("Tỷ lệ Điểm Tích cực giữ lại", fontsize=12)
plt.ylim(0, 1.05)
plt.xlim(0, 60)
plt.grid(True, linestyle='--', alpha=0.6)
plt.legend(fontsize=12)

# Lưu thành file ảnh chất lượng cao để chèn vào Slide/LaTeX
output_path = "reports/time_decay_curve.png"
plt.tight_layout()
plt.savefig(output_path, dpi=300, bbox_inches='tight')
print(f"Biểu đồ đã được lưu thành công tại: {output_path}")
