# Xác minh bản bàn giao

Xác minh lần cuối ngày 27/09/2026 trên bản nằm tại
`/home/vytrieule/Downloads/Projects/NEUselfPOS`.

## Kết quả

- `apps/api`: TypeScript production build thành công.
- `apps/web`: Next.js production build, kiểm tra kiểu và tạo route thành công.
- Docker Compose dựng đủ ba dịch vụ `mongo`, `api`, `web`; cả ba ở trạng thái
  `healthy`.
- Health endpoint trả về `status: ok`, `database: connected` và
  `paymentMode: DEMO`.
- Bộ kiểm thử hợp đồng API đạt 41/41 kiểm tra, gồm đăng nhập, phân quyền, giá
  do server tính, chống bán quá tồn, checkout đồng thời, tính lặp an toàn khi
  thanh toán/hủy/hoàn đơn và lịch sử kho.
- Bộ kiểm thử trình duyệt đi qua đăng nhập, dashboard, sản phẩm, POS nhân viên,
  đơn hàng, kho, khách hàng, nhân sự, cấu hình, kiosk, QR mô phỏng, phiếu mua
  hàng và giao diện kiosk 390 px.
- Sau khi restart cả API và web, dữ liệu vẫn giữ nguyên trong volume MongoDB,
  không nằm trong bộ nhớ của ứng dụng. Tại lần xác minh cuối có 21 sản phẩm,
  20 đơn hàng, 24 lô tồn và không còn sản phẩm tạm mang SKU `QA-*`.
- Catalog mẫu, dữ liệu người dùng đã nhập và các đơn demo được giữ lại; dữ liệu
  tạm do bộ kiểm thử API tạo ra đã được dọn theo đúng tiền tố `QA-*`.

Ảnh chụp kết quả nằm trong `test-results/`: dashboard, danh sách sản phẩm,
kiosk desktop/mobile, màn hình QR demo và phiếu mua hàng.

## Bổ sung ngày 23/09/2026

- Dashboard đã bổ sung lợi nhuận gộp, biên lợi nhuận và Cố vấn kinh doanh đọc
  trực tiếp số liệu doanh thu, hàng bán chạy và tồn thấp. Kiểm thử trình duyệt
  đã gửi câu hỏi nhanh và nhận phản hồi trong giao diện.
- Kho hàng đã phân biệt `PURCHASE` (nhập hàng), `ADJUSTMENT` (kiểm kê/điều
  chỉnh) và `DAMAGE` (xuất hủy). Kiểm thử API xác nhận nhập hàng tăng tồn,
  xuất hủy giảm tồn và cả hai loại xuất hiện đúng trong nhật ký.
- Giao diện quản lý sản phẩm cho phép tải lên, xem trước, thay và gỡ ảnh PNG,
  JPEG hoặc WebP tối đa 3 MB. Đã kiểm tra tải ảnh qua API, lưu URL vào sản
  phẩm, đọc lại ảnh qua web và khôi phục dữ liệu thử thành công.
- Ảnh tải lên được giữ trong volume Docker `neuselfpos_neu_uploads`; việc dựng
  lại container không xóa ảnh.

## Bổ sung ngày 27/09/2026

- Kho được mở rộng từ tồn tổng sang tồn theo lô: mã lô, ngày nhập, ngày sản
  xuất, hạn sử dụng, số lượng và trạng thái cảnh báo.
- API từ chối nhập lô đã hết hạn, xuất hủy vượt số lượng lô và bán phần tồn đã
  quá hạn. Tồn vật lý và tồn có thể bán được hiển thị riêng.
- Checkout áp dụng FEFO. Kiểm thử đã xác nhận đơn bán lấy lô có hạn gần nhất
  trước lô không có hạn, đồng thời hủy/hoàn đơn trả lại đúng lô đã cấp phát.
- Trang Nhập hàng riêng hỗ trợ một phiếu nhiều dòng, nhà cung cấp, chứng từ,
  giá nhập và lịch sử phiếu. Việc ghi phiếu và tăng tồn chạy trong transaction.
- Bộ kiểm thử hợp đồng API hiện đạt 41/41 kiểm tra; kiểm thử trình duyệt xác
  nhận màn hình danh sách lô và biểu mẫu nhập mã lô/hạn sử dụng hoạt động.

## Phạm vi an toàn

Đây là prototype đồ án chạy local. QR chỉ mô phỏng trạng thái thanh toán và
không tạo giao dịch ngân hàng. MongoDB và API không mở cổng ra ngoài; chỉ web
được bind vào `127.0.0.1`.

Kết quả chạy thử EraPOS gốc được ghi riêng tại `docs/ORIGINAL-INSPECTION.md`.
