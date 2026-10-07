# Ghi nhận kiểm tra dự án tham chiếu EraPOS

Ngày kiểm tra: 16/09/2026. Đây là ghi chú kỹ thuật phục vụ phát triển và bàn giao.

## Phạm vi và cách chạy

Đã kiểm tra `../EraPOS/pos-system` và `../EraPOS/basic-pos-system-be`. Để giữ nguyên mã nguồn và cấu hình cũ, ứng dụng retail được chạy từ một bản sao tạm, loại trừ `.env*`, `.git`, `secrets`, `node_modules` và các thư mục build. Không khởi động hoặc thay đổi database của EraPOS.

Các lệnh đã chạy trong bản sao:

```sh
npm ci --ignore-scripts --legacy-peer-deps --no-audit --no-fund
npm run build --workspace=@repo/utils
NEXT_TELEMETRY_DISABLED=1 npx next dev apps/web/retail --hostname 127.0.0.1 --port 3101
```

Kết quả: cài đặt 1.649 package thành công, build `@repo/utils` thành công, Next.js 14.2.31 khởi động và `GET /` trả HTTP 200. Tiêu đề trang là “EraPOS - Phần mềm quản lý bán hàng”. Giao diện thực tế hiển thị “Hello World” và “Welcome to the retail domain”; đường dẫn `/logo.png` trả HTTP 404. Đã kiểm tra ảnh chụp màn hình bằng Firefox headless. Server kiểm tra đã được dừng; hai repository gốc không có thay đổi sau kiểm tra.

## Nền tảng có thể đối chiếu

| Thành phần | Bằng chứng trong nguồn EraPOS |
| --- | --- |
| Web | `pos-system/apps/web/retail/package.json`: Next.js 14, React 18, TypeScript |
| Giao diện | `pos-system/packages/design-system`: Mantine 8, Tailwind 4, Inter, màu chính `#2563eb`, nền sáng và thẻ trắng bo góc |
| API của monorepo | `pos-system/apps/server/api/package.json`: Express 4, TypeScript |
| Dữ liệu của monorepo | `pos-system/packages/database/prisma/schema.prisma`: Prisma 6, MongoDB |
| Backend riêng | `basic-pos-system-be`: NestJS 11, Prisma 6 và PostgreSQL; đây là phương án khác, không phải stack API của monorepo chính |

`pos-system/docs/brief/brief-mvp.md` mô tả các nghiệp vụ sản phẩm, danh mục, tồn kho, khách hàng, hóa đơn, báo cáo và quầy bán hàng. Tuy nhiên, trang retail và trang main trong mã nguồn được cung cấp hiện là trang khởi tạo; các nghiệp vụ trong tài liệu không đồng nghĩa với chức năng đã chạy hoàn chỉnh. Không tìm thấy giao diện quầy bán hàng hoàn thiện để sao chép nguyên trạng.

## Ý nghĩa của phiên bản NEU SelfPOS

NEU SelfPOS được phát triển độc lập trong thư mục này, đối chiếu stack chính Next.js / React / TypeScript / Express / Prisma / MongoDB và phong cách màu xanh, nền sáng của EraPOS. Các màn hình nghiệp vụ và luồng tự thanh toán cần được triển khai trong phiên bản NEU, không thể chỉ đổi logo để có một ứng dụng chạy đầy đủ.

Phạm vi phiên bản NEU gồm quầy thu ngân, kiosk tự thanh toán, sản phẩm và danh mục, tồn kho, đơn hàng, khách hàng, báo cáo, tài khoản và cấu hình điểm bán. Các chức năng được nghiệm thu bằng việc chạy phiên bản NEU và kiểm tra luồng tương ứng; kết quả kiểm tra EraPOS ở trên không phải bằng chứng nghiệm thu NEU.

Mô hình demo sử dụng dữ liệu mẫu và thanh toán QR mô phỏng. Logo NEU thể hiện bối cảnh đề án; ứng dụng không được mô tả là hệ thống chính thức đã triển khai tại trường.
