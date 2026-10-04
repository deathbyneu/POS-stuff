# EasyRetail

Ứng dụng quản lý bán hàng, nhập hàng và tồn kho cho cửa hàng tiện ích. Đây là prototype học tập có database thật, quản lý lô và hạn sử dụng, đồng thời hỗ trợ VietQR qua payOS; mặc định chạy ở chế độ demo cho đến khi được cấu hình.

## Chạy bằng Docker

Cần Docker Engine và Docker Compose v2 trở lên. Từ thư mục có `docker-compose.yml`:

```bash
docker compose up -d --build
docker compose ps
```

Lần đầu cần Internet để tải image và thư viện. MongoDB tự tạo replica set, API tự đồng bộ schema và thêm dữ liệu mẫu. Chờ ba dịch vụ báo `healthy`, rồi mở:

- Quản trị: http://localhost:3000
- Quầy nhân viên: http://localhost:3000/pos
- Kiểm tra kết nối database: http://localhost:3000/api/health

| Tài khoản | Email                    | Mật khẩu demo  |
| --------- | ------------------------ | -------------- |
| Quản lý   | `admin@easyretail.local` | `EasyRetail@2026` |
| Nhân viên | `staff@easyretail.local` | `EasyRetail@2026` |

Kiosk không cần đăng nhập. Các chức năng quản trị yêu cầu tài khoản và kiểm tra quyền ở API.

Nếu cổng 3000 đang dùng:

```bash
WEB_PORT=3100 docker compose up -d --build
```

Sau đó truy cập `http://localhost:3100`.

## Thao tác vận hành

```bash
docker compose logs -f --tail=80       # Xem log
docker compose stop                  # Dừng, giữ nguyên database
docker compose up -d                  # Chạy lại, giữ nguyên database
docker compose restart api web       # Khởi động lại ứng dụng
```

Database được lưu trong named volume `neuselfpos_neu_mongo_data`; ảnh sản phẩm tải lên được lưu trong `neuselfpos_neu_uploads`. Cả hai không mất khi restart hoặc dựng lại image. Không dùng `docker compose down -v` nếu muốn giữ dữ liệu. Cổng MongoDB và API không được công khai ra máy chủ; trình duyệt đi qua web cùng nguồn.

## Chức năng

- Dashboard doanh thu, đơn hàng, lợi nhuận gộp, hàng bán chạy và cảnh báo tồn thấp.
- Cố vấn kinh doanh dạng hội thoại: gửi câu hỏi cùng số liệu tổng hợp trên dashboard tới Google Gemini để trả lời về xu hướng doanh thu, lợi nhuận, hàng bán chạy, tồn thấp và gợi ý ưu tiên. Cần cấu hình `GEMINI_API_KEY`; không bật nếu chính sách không cho phép gửi dữ liệu tổng hợp tới dịch vụ ngoài.
- Danh mục và sản phẩm: mã vạch, SKU, ảnh có thể tải lên/thay thế, giá bán, giá vốn, tồn tối thiểu, trạng thái.
- Bán hàng tại quầy, tìm kiếm/lọc danh mục, thêm/xóa/sửa số lượng trong giỏ.
- Quầy bán hàng hỗ trợ máy quét USB HID hoặc nhập mã + Enter.
- Thanh toán QR demo, trạng thái chờ/hoàn tất/hủy, phiếu mua hàng có thể in.
- Tiền mặt tại quầy nhân viên; kiosk dành cho QR.
- Lịch sử đơn hàng, chi tiết và hoàn đơn theo quyền quản lý.
- Xử lý kho theo ba nghiệp vụ nhập hàng, kiểm kê/điều chỉnh và xuất hủy; có lịch sử biến động theo loại nghiệp vụ.
- Quản lý lô hàng với mã lô, ngày nhập, ngày sản xuất và hạn sử dụng; cảnh báo lô đã hết hạn, còn dưới 7 ngày hoặc dưới 30 ngày.
- Trang Nhập hàng riêng để lập một phiếu gồm nhiều mặt hàng/lô, nhà cung cấp, chứng từ, giá nhập và ghi chú; có lịch sử phiếu nhập.
- Checkout tự động xuất theo FEFO (lô hết hạn trước được dùng trước); hủy thanh toán và hoàn đơn trả hàng về đúng lô đã xuất.
- Khách hàng, tài khoản nhân viên và phân quyền.
- Cấu hình tên điểm bán, địa chỉ, điện thoại và lời nhắn trên phiếu.

Ở cấu hình mặc định, QR là dữ liệu demo và không phát sinh giao dịch tài chính. Khi bật `PAYMENT_PROVIDER=PAYOS`, QR là VietQR chuyển khoản thật; đơn chỉ hoàn tất sau khi webhook có chữ ký hợp lệ từ payOS xác nhận đúng mã đơn và số tiền. Phiếu mua hàng vẫn chỉ là biên nhận bán hàng, không phải hóa đơn điện tử thuế.

## Bật thanh toán VietQR thật qua payOS

Sao chép `.env.example` thành `.env`, sau đó cấu hình:

```dotenv
DEMO_MODE=false
PAYMENT_PROVIDER=PAYOS
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
PUBLIC_APP_URL=http://localhost:3000
```

Chạy local vẫn thanh toán được: frontend hỏi trạng thái mỗi 5 giây và backend truy vấn trực tiếp payOS để xác nhận giao dịch. Để nhận webhook tức thời và vận hành ổn định khi kiosk không còn mở, đặt `PUBLIC_APP_URL` thành URL HTTPS công khai. Khi API khởi động, hệ thống tự đăng ký webhook `${PUBLIC_APP_URL}/api/payments/payos/webhook` với payOS. Có thể dùng một HTTPS tunnel trỏ tới `http://localhost:3000` khi thử từ máy local.

Không commit file `.env` hoặc đưa các khóa payOS vào source. payOS không có sandbox riêng; mọi QR ở chế độ này đều có thể nhận tiền thật, vì vậy chỉ nên thử với số tiền nhỏ. Chức năng hoàn đơn payOS hiện bị chặn vì chuyển khoản VietQR không có API hoàn tiền tự động trong luồng này; cần hoàn tiền thủ công và đối soát riêng.

## Demo trong 5 phút

1. Đăng nhập quản lý, xem dashboard và mở Sản phẩm để lấy barcode hoặc thay barcode bằng mã trên sản phẩm đang có.
2. Mở `/kiosk` ở cửa sổ riêng. Quét hai sản phẩm; quét lại một mã để tăng số lượng, sau đó giảm/xóa thử.
3. Chọn thanh toán QR. Màn hình hiển thị tổng tiền và mã đơn. Bấm xác nhận thanh toán demo để tạo phiếu hoàn tất.
4. Quay lại trang Đơn hàng: giao dịch vừa tạo được lưu trong MongoDB. Kiểm tra tồn kho giảm tương ứng.
5. Mở Nhập hàng để tạo một phiếu nhiều mặt hàng; vào Kho hàng để xem lô vừa nhập hoặc xuất hủy đúng lô. Quay lại dashboard và hỏi Cố vấn kinh doanh về hạn sử dụng.
6. Refresh trang hoặc restart API: sản phẩm, đơn và thay đổi kho vẫn còn.

Máy quét cần ở chế độ USB keyboard/HID và gửi Enter ở cuối barcode. Có thể nhập tay barcode rồi nhấn Enter để thử trước khi cắm máy quét. Mã vạch phải được khai báo trên sản phẩm; số in trên bao bì không tự xuất hiện trong database.

## Stack và cấu trúc

Giữ bộ công nghệ của monorepo EraPOS trong workspace: Next.js 14, React 18, TypeScript, Mantine, Express 4, Prisma 6 và MongoDB. MongoDB chạy replica set một node để hỗ trợ transaction; web dùng cấu hình production standalone. Màu chủ đạo xanh `#2563eb`, card trắng/xám và nhận diện EasyRetail độc lập.

```text
NEUselfPOS/
├── docker-compose.yml
├── apps/
│   ├── web/        # Next.js, giao diện và reverse proxy /api
│   └── api/        # Express, Prisma schema, seed và nghiệp vụ
├── docs/           # Hướng dẫn và bằng chứng kiểm tra
└── tests/          # Kiểm thử tích hợp qua trình duyệt
```

Sản phẩm, tồn kho, đơn hàng được xử lý ở server; server tính giá từ database thay vì tin tổng tiền phía trình duyệt. Các thao tác thanh toán/hoàn đơn kiểm soát lặp để không trừ hoặc cộng kho hai lần. Dữ liệu mẫu phục vụ demo được thêm khi khởi tạo, không phải giao dịch thực tế của trường.

## Logo

Logo EasyRetail được thiết kế riêng cho đồ án. Chi tiết tài nguyên nằm ở `apps/web/public/ASSETS.md`.

## Kiểm thử

```bash
npm ci
npx playwright install chromium
npm run test:api
npm run test:e2e
```

Kiểm thử cần stack Docker đang chạy. Kết quả và ảnh chụp được lưu trong `test-results/`. Xem `docs/VERIFICATION.md` cho kiểm tra đã thực hiện trên bản bàn giao.

## Tài liệu use case

Bộ sơ đồ tổng quan, self-checkout, quản trị và đặc tả 17 use case nằm trong
`docs/use-cases/`. Bản đầy đủ để nộp là
`docs/use-cases/NEU-SelfPOS-Use-Case-Full.pdf`; bản Word có thể chỉnh sửa là
`docs/use-cases/NEU-SelfPOS-Use-Case-Spec.docx`.

## Tài liệu kiến trúc

Xem [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) để hiểu sơ đồ container, luồng
checkout/thanh toán, vòng đời đơn hàng, mô hình dữ liệu và vai trò của từng file.
