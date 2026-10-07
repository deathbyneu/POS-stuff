# Đặc tả use case — NEU SelfPOS

## 1. Tác nhân

| Tác nhân                     | Mô tả                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Sinh viên / Người mua        | Sử dụng kiosk không cần đăng nhập để tự chọn, quét và thanh toán hàng hóa.     |
| Nhân viên bán hàng           | Đăng nhập để bán hàng tại quầy, xem đơn hàng, khách hàng và tình trạng kho.    |
| Quản trị viên / Chủ điểm bán | Kế thừa quyền Nhân viên; có thêm quyền quản lý cấu hình và dữ liệu quan trọng. |
| Máy quét mã vạch             | Thiết bị USB HID nhập barcode và gửi phím Enter cho hệ thống.                  |
| Dịch vụ QR mô phỏng          | Tác nhân ngoài mô phỏng việc xác nhận kết quả thanh toán QR trong prototype.   |

## 2. Danh sách use case

| Mã   | Tên use case                     | Tác nhân chính                 | Mức ưu tiên |
| ---- | -------------------------------- | ------------------------------ | ----------- |
| UC01 | Tra cứu / chọn sản phẩm          | Người mua                      | Cao         |
| UC02 | Quét mã sản phẩm                 | Người mua, Máy quét            | Cao         |
| UC03 | Quản lý giỏ hàng                 | Người mua                      | Cao         |
| UC04 | Xác nhận và tạo đơn hàng         | Người mua                      | Cao         |
| UC05 | Thanh toán QR                    | Người mua, Dịch vụ QR mô phỏng | Cao         |
| UC06 | Xem / in phiếu mua hàng          | Người mua                      | Trung bình  |
| UC07 | Đăng nhập / đăng xuất            | Nhân viên, Quản trị viên       | Cao         |
| UC08 | Bán hàng tại quầy                | Nhân viên                      | Cao         |
| UC09 | Tra cứu đơn hàng                 | Nhân viên                      | Cao         |
| UC10 | Quản lý khách hàng               | Nhân viên                      | Trung bình  |
| UC11 | Xem tồn kho và lịch sử biến động | Nhân viên                      | Cao         |
| UC12 | Xem dashboard và báo cáo         | Quản trị viên                  | Cao         |
| UC13 | Quản lý sản phẩm và danh mục     | Quản trị viên                  | Cao         |
| UC14 | Điều chỉnh tồn kho               | Quản trị viên                  | Cao         |
| UC15 | Hoàn đơn hàng                    | Quản trị viên                  | Cao         |
| UC16 | Quản lý tài khoản và phân quyền  | Quản trị viên                  | Trung bình  |
| UC17 | Cấu hình điểm bán                | Quản trị viên                  | Thấp        |

## 3. Đặc tả chi tiết

### UC01 — Tra cứu / chọn sản phẩm

| Thuộc tính     | Nội dung                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                                                                                     |
| Mục tiêu       | Tìm và chọn đúng sản phẩm cần mua trên kiosk.                                                                                                                                                             |
| Tiền điều kiện | Kiosk truy cập được hệ thống; sản phẩm đang ở trạng thái hoạt động.                                                                                                                                       |
| Kích hoạt      | Người mua mở màn hình tự thanh toán.                                                                                                                                                                      |
| Luồng chính    | 1. Hệ thống hiển thị danh sách và danh mục sản phẩm. 2. Người mua nhập tên, barcode hoặc SKU, hoặc chọn danh mục. 3. Hệ thống lọc kết quả. 4. Người mua chọn sản phẩm. 5. Hệ thống thêm sản phẩm vào giỏ. |
| Ngoại lệ       | Nếu sản phẩm hết hàng, hệ thống không cho thêm và hiển thị thông báo.                                                                                                                                     |
| Hậu điều kiện  | Sản phẩm được thêm vào giỏ với số lượng 1.                                                                                                                                                                |

### UC02 — Quét mã sản phẩm

| Thuộc tính     | Nội dung                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                                                                                 |
| Tác nhân phụ   | Máy quét mã vạch                                                                                                                                                                                      |
| Mục tiêu       | Thêm nhanh sản phẩm vào giỏ bằng barcode hoặc SKU.                                                                                                                                                    |
| Tiền điều kiện | Máy quét ở chế độ USB keyboard/HID và sản phẩm đã có mã trong hệ thống.                                                                                                                               |
| Kích hoạt      | Người mua quét mã hoặc nhập mã rồi nhấn Enter.                                                                                                                                                        |
| Luồng chính    | 1. Máy quét gửi chuỗi mã và Enter. 2. Hệ thống tìm sản phẩm đang hoạt động. 3. Hệ thống kiểm tra tồn hiện tại. 4. Hệ thống thêm sản phẩm hoặc tăng số lượng trong giỏ. 5. Hệ thống thông báo đã thêm. |
| Ngoại lệ       | Không tìm thấy mã: báo mã không hợp lệ. Hết hàng hoặc số lượng trong giỏ đã bằng tồn kho: từ chối tăng số lượng.                                                                                      |
| Hậu điều kiện  | Giỏ hàng phản ánh đúng sản phẩm vừa quét.                                                                                                                                                             |

### UC03 — Quản lý giỏ hàng

| Thuộc tính     | Nội dung                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                                                                     |
| Mục tiêu       | Kiểm tra và chỉnh số lượng trước khi đặt hàng.                                                                                                                                            |
| Tiền điều kiện | Giỏ có ít nhất một sản phẩm.                                                                                                                                                              |
| Kích hoạt      | Người mua bấm tăng, giảm hoặc xóa một dòng hàng.                                                                                                                                          |
| Luồng chính    | 1. Hệ thống hiển thị tên, đơn giá, số lượng và thành tiền. 2. Người mua thay đổi số lượng. 3. Hệ thống kiểm tra giới hạn tồn kho. 4. Hệ thống cập nhật tổng số món và tổng tiền tạm tính. |
| Ngoại lệ       | Giảm số lượng về 0 thì dòng hàng bị xóa. Không được tăng vượt tồn kho.                                                                                                                    |
| Hậu điều kiện  | Giỏ và tổng tiền tạm tính được cập nhật.                                                                                                                                                  |

### UC04 — Xác nhận và tạo đơn hàng

| Thuộc tính     | Nội dung                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                                                                                                                                               |
| Mục tiêu       | Tạo đơn chờ thanh toán từ giỏ hàng hợp lệ.                                                                                                                                                                                                                          |
| Tiền điều kiện | Giỏ không rỗng; phương thức thanh toán là QR.                                                                                                                                                                                                                       |
| Kích hoạt      | Người mua bấm “Tiến hành thanh toán”.                                                                                                                                                                                                                               |
| Quan hệ        | `<<include>>` Kiểm tra tồn kho; Tính tổng tiền từ CSDL; Giữ hàng trong kho.                                                                                                                                                                                         |
| Luồng chính    | 1. Gửi danh sách mã sản phẩm và số lượng lên máy chủ. 2. Máy chủ đọc giá hiện hành từ CSDL. 3. Máy chủ kiểm tra tồn cho từng mặt hàng. 4. Máy chủ trừ tạm số lượng để giữ hàng. 5. Tạo mã đơn duy nhất ở trạng thái chờ. 6. Trả thông tin đơn và mã truy cập phiếu. |
| Ngoại lệ       | Sản phẩm ngừng bán hoặc không đủ tồn: không tạo đơn và hiển thị lý do. Yêu cầu lặp lại có cùng mã request không tạo thêm đơn hoặc trừ kho lần hai.                                                                                                                  |
| Hậu điều kiện  | Đơn `PENDING` được lưu; tồn kho được giữ; thời hạn thanh toán là 10 phút.                                                                                                                                                                                           |

### UC05 — Thanh toán QR

| Thuộc tính     | Nội dung                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                                                                                                      |
| Tác nhân phụ   | Dịch vụ QR mô phỏng                                                                                                                                                                                                        |
| Mục tiêu       | Hoàn tất đơn tự thanh toán bằng QR.                                                                                                                                                                                        |
| Tiền điều kiện | Đơn đang `PENDING` và chưa hết hạn.                                                                                                                                                                                        |
| Kích hoạt      | Hệ thống hiển thị QR; người mua thực hiện và xác nhận thanh toán demo.                                                                                                                                                     |
| Quan hệ        | `<<include>>` Tạo/hiển thị QR; Ghi nhận thanh toán. `<<extend>>` Hủy đơn; Tự hủy khi hết hạn.                                                                                                                              |
| Luồng chính    | 1. Hiển thị mã đơn, tổng tiền và QR. 2. Người mua xác nhận thanh toán mô phỏng. 3. Hệ thống kiểm tra token và thời hạn. 4. Chuyển trạng thái sang `COMPLETED`. 5. Ghi thời điểm thanh toán và cộng điểm khách hàng nếu có. |
| Ngoại lệ       | Người mua hủy: đơn thành `CANCELLED` và hoàn tồn. Quá 10 phút: hệ thống tự hủy và hoàn tồn. Đơn đã xử lý không bị ghi nhận lặp lần hai.                                                                                    |
| Hậu điều kiện  | Đơn hoàn tất hoặc bị hủy; tồn kho và trạng thái đơn nhất quán.                                                                                                                                                             |

### UC06 — Xem / in phiếu mua hàng

| Thuộc tính     | Nội dung                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tác nhân chính | Sinh viên / Người mua                                                                                                                      |
| Mục tiêu       | Nhận bằng chứng giao dịch sau khi thanh toán thành công.                                                                                   |
| Tiền điều kiện | Đơn ở trạng thái `COMPLETED` và người dùng có token hợp lệ của đơn.                                                                        |
| Luồng chính    | 1. Hệ thống hiển thị mã đơn, thời gian, mặt hàng, số lượng, giá và tổng tiền. 2. Người mua kiểm tra kết quả. 3. Người mua chọn in nếu cần. |
| Ngoại lệ       | Token sai thì từ chối truy cập thông tin đơn.                                                                                              |
| Hậu điều kiện  | Phiếu được xem hoặc gửi tới hộp thoại in của trình duyệt.                                                                                  |

### UC07 — Đăng nhập / đăng xuất

| Thuộc tính     | Nội dung                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Nhân viên, Quản trị viên                                                                                                                                                                                                           |
| Mục tiêu       | Xác thực người dùng và cấp đúng quyền chức năng.                                                                                                                                                                                   |
| Tiền điều kiện | Tài khoản tồn tại và đang hoạt động.                                                                                                                                                                                               |
| Luồng chính    | 1. Người dùng nhập email, mật khẩu. 2. Hệ thống kiểm tra mật khẩu mã hóa và trạng thái tài khoản. 3. Tạo phiên đăng nhập 12 giờ bằng cookie HTTP-only. 4. Hiển thị menu theo vai trò. 5. Khi đăng xuất, hệ thống xóa cookie phiên. |
| Ngoại lệ       | Sai thông tin hoặc tài khoản bị khóa: từ chối đăng nhập. Giới hạn số lần thử trong 15 phút.                                                                                                                                        |
| Hậu điều kiện  | Phiên hợp lệ được tạo hoặc bị kết thúc.                                                                                                                                                                                            |

### UC08 — Bán hàng tại quầy

| Thuộc tính     | Nội dung                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Nhân viên bán hàng                                                                                                                                                                                                              |
| Mục tiêu       | Xử lý đơn có nhân viên hỗ trợ bằng tiền mặt hoặc QR.                                                                                                                                                                            |
| Tiền điều kiện | Nhân viên đã đăng nhập.                                                                                                                                                                                                         |
| Luồng chính    | 1. Nhân viên tìm hoặc quét sản phẩm. 2. Chỉnh giỏ hàng. 3. Có thể gắn khách hàng. 4. Chọn tiền mặt hoặc QR. 5. Hệ thống kiểm tra giá, tồn kho và tạo đơn. 6. Đơn tiền mặt hoàn tất ngay; đơn QR đi qua UC05. 7. Hiển thị phiếu. |
| Ngoại lệ       | Không đủ tồn hoặc dữ liệu giỏ không hợp lệ: không tạo đơn. Người không đăng nhập không thể tạo đơn tiền mặt.                                                                                                                    |
| Hậu điều kiện  | Đơn được lưu, tồn kho giảm và điểm khách hàng được cập nhật khi hoàn tất.                                                                                                                                                       |

### UC09 — Tra cứu đơn hàng

| Thuộc tính     | Nội dung                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tác nhân chính | Nhân viên bán hàng                                                                                                                                                       |
| Mục tiêu       | Theo dõi giao dịch và xem chi tiết đơn.                                                                                                                                  |
| Tiền điều kiện | Người dùng đã đăng nhập.                                                                                                                                                 |
| Luồng chính    | 1. Hệ thống hiển thị các đơn mới nhất. 2. Người dùng lọc theo trạng thái. 3. Chọn mã đơn. 4. Hệ thống hiển thị kênh bán, phương thức, mặt hàng, tổng tiền và trạng thái. |
| Ngoại lệ       | Đơn không tồn tại: hiển thị thông báo lỗi.                                                                                                                               |
| Hậu điều kiện  | Không thay đổi dữ liệu.                                                                                                                                                  |

### UC10 — Quản lý khách hàng

| Thuộc tính     | Nội dung                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Nhân viên bán hàng                                                                                                                                  |
| Mục tiêu       | Lưu và cập nhật thông tin khách quen.                                                                                                               |
| Tiền điều kiện | Người dùng đã đăng nhập.                                                                                                                            |
| Luồng chính    | 1. Xem/tìm khách bằng tên hoặc số điện thoại. 2. Thêm khách mới hoặc mở khách hiện có. 3. Nhập tên, điện thoại, email. 4. Hệ thống kiểm tra và lưu. |
| Ngoại lệ       | Số điện thoại/email không hợp lệ hoặc bị trùng: từ chối lưu.                                                                                        |
| Hậu điều kiện  | Hồ sơ khách được tạo/cập nhật; điểm vẫn do giao dịch tự động điều chỉnh.                                                                            |

### UC11 — Xem tồn kho và lịch sử biến động

| Thuộc tính     | Nội dung                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Nhân viên bán hàng                                                                                                                                      |
| Mục tiêu       | Biết lượng hàng hiện tại và nguồn gốc biến động.                                                                                                        |
| Tiền điều kiện | Người dùng đã đăng nhập.                                                                                                                                |
| Luồng chính    | 1. Hệ thống hiển thị tồn hiện tại và ngưỡng tồn tối thiểu. 2. Đánh dấu sản phẩm tồn thấp. 3. Người dùng xem lịch sử nhập, bán, giữ, hoàn và điều chỉnh. |
| Hậu điều kiện  | Không thay đổi dữ liệu.                                                                                                                                 |

**Bổ sung quản lý lô:** hệ thống hiển thị riêng tồn vật lý và tồn còn đủ điều
kiện bán; mỗi lô có mã lô, ngày nhập, ngày sản xuất, hạn sử dụng và số lượng.
Lô đã hết hạn, còn dưới 7 ngày hoặc dưới 30 ngày được cảnh báo theo mức độ.

### UC12 — Xem dashboard và báo cáo

| Thuộc tính     | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tác nhân chính | Quản trị viên                                                                                                                                                                                                                                                                                                                                                                                                |
| Mục tiêu       | Theo dõi doanh thu và tình hình vận hành điểm bán.                                                                                                                                                                                                                                                                                                                                                           |
| Tiền điều kiện | Quản trị viên đã đăng nhập.                                                                                                                                                                                                                                                                                                                                                                                  |
| Luồng chính    | 1. Chọn khoảng thời gian hợp lệ. 2. Hệ thống tổng hợp đơn hoàn tất. 3. Hiển thị doanh thu, số đơn, giá trị trung bình, lợi nhuận gộp, đồ thị theo ngày, hàng bán chạy, đơn gần đây và cảnh báo tồn thấp. 4. Quản trị viên chọn câu hỏi nhanh hoặc nhập câu hỏi cho Cố vấn kinh doanh. 5. Hệ thống phân tích số liệu hiện có và trả lời về doanh thu, biên gộp, hàng bán chạy, tồn kho hoặc việc cần ưu tiên. |
| Ngoại lệ       | Khoảng ngày ngược hoặc quá 366 ngày: từ chối truy vấn.                                                                                                                                                                                                                                                                                                                                                       |
| Hậu điều kiện  | Không thay đổi dữ liệu.                                                                                                                                                                                                                                                                                                                                                                                      |
| Quy tắc        | Khuyến nghị chỉ dựa trên dữ liệu của điểm bán, không gửi dữ liệu ra dịch vụ ngoài và được ghi rõ là thông tin tham khảo.                                                                                                                                                                                                                                                                                     |

### UC13 — Quản lý sản phẩm và danh mục

| Thuộc tính     | Nội dung                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Quản trị viên                                                                                                                                                                                                                       |
| Mục tiêu       | Duy trì catalog, ảnh, barcode, SKU, giá và trạng thái bán.                                                                                                                                                                          |
| Tiền điều kiện | Quản trị viên đã đăng nhập.                                                                                                                                                                                                         |
| Luồng chính    | 1. Xem/tìm sản phẩm. 2. Thêm danh mục khi cần. 3. Thêm sản phẩm với tên, mã, ảnh, giá, giá vốn, tồn đầu kỳ và ngưỡng cảnh báo. 4. Tải lên, thay hoặc gỡ ảnh sản phẩm. 5. Sửa thông tin sản phẩm. 6. Chuyển sản phẩm sang ngừng bán. |
| Ngoại lệ       | Barcode, SKU hoặc tên danh mục trùng: từ chối lưu. Ảnh sai định dạng hoặc lớn hơn 3 MB: từ chối tải lên. Danh mục còn sản phẩm thì không được xóa.                                                                                  |
| Hậu điều kiện  | Catalog được cập nhật; tồn đầu kỳ được ghi thành một biến động kho.                                                                                                                                                                 |

### UC14 — Điều chỉnh tồn kho

| Thuộc tính     | Nội dung                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Quản trị viên                                                                                                                                                                                                                                                           |
| Mục tiêu       | Ghi nhận nhập hàng, kiểm kê tăng/giảm và xuất hủy có phân loại rõ ràng.                                                                                                                                                                                                 |
| Tiền điều kiện | Quản trị viên đã đăng nhập; sản phẩm tồn tại.                                                                                                                                                                                                                           |
| Luồng chính    | 1. Chọn sản phẩm. 2. Chọn loại nghiệp vụ: Nhập hàng, Kiểm kê/điều chỉnh hoặc Xuất hủy. 3. Nhập số lượng và lý do. 4. Hệ thống kiểm tra dấu và giới hạn số lượng. 5. Cập nhật tồn trong transaction. 6. Ghi lịch sử loại nghiệp vụ, người thực hiện, thời gian và lý do. |
| Ngoại lệ       | Số lượng bằng 0, nhập hàng mang số âm, xuất hủy mang số dương, làm tồn âm hoặc vượt giới hạn: từ chối cập nhật.                                                                                                                                                         |
| Hậu điều kiện  | Tồn và nhật ký biến động được cập nhật đồng thời.                                                                                                                                                                                                                       |

**Quy tắc lô hàng:** khi nhập hàng, quản trị viên khai báo mã lô và hạn sử dụng;
khi xuất hủy phải chọn đúng lô. Hệ thống từ chối lô có dữ liệu ngày không hợp
lệ hoặc số lượng vượt tồn lô. Khi bán, hệ thống tự chọn lô theo FEFO; khi hủy
hoặc hoàn đơn, số lượng được trả về đúng lô đã cấp phát.

**Phiếu nhập hàng:** quản trị viên mở trang Nhập hàng, khai báo nhà cung cấp và
số chứng từ, sau đó thêm một hoặc nhiều dòng gồm sản phẩm, số lượng, giá nhập,
mã lô, ngày sản xuất và hạn sử dụng. Hệ thống chỉ ghi phiếu, cập nhật tồn tổng,
tồn lô và giá vốn khi toàn bộ dòng hợp lệ; lịch sử phiếu được lưu để tra cứu.

### UC15 — Hoàn đơn hàng

| Thuộc tính     | Nội dung                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Quản trị viên                                                                                                                                                                                      |
| Mục tiêu       | Đảo giao dịch đã hoàn tất và trả hàng về kho.                                                                                                                                                      |
| Tiền điều kiện | Quản trị viên đã đăng nhập; đơn đang `COMPLETED`.                                                                                                                                                  |
| Luồng chính    | 1. Mở chi tiết đơn. 2. Chọn hoàn đơn. 3. Hệ thống xác nhận đơn hợp lệ. 4. Chuyển trạng thái sang `REFUNDED`. 5. Cộng lại tồn từng sản phẩm. 6. Ghi lịch sử hoàn và trừ lại điểm khách hàng nếu có. |
| Ngoại lệ       | Đơn đang chờ, đã hủy hoặc không tồn tại: từ chối. Gửi lặp yêu cầu không hoàn kho lần hai.                                                                                                          |
| Hậu điều kiện  | Đơn đã hoàn; tồn kho và điểm khách hàng được phục hồi nhất quán.                                                                                                                                   |

### UC16 — Quản lý tài khoản và phân quyền

| Thuộc tính     | Nội dung                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Quản trị viên                                                                                                                                                                          |
| Mục tiêu       | Tạo, phân quyền và khóa/mở tài khoản vận hành.                                                                                                                                         |
| Tiền điều kiện | Quản trị viên đã đăng nhập.                                                                                                                                                            |
| Luồng chính    | 1. Xem danh sách tài khoản. 2. Tạo tài khoản với vai trò Nhân viên/Quản trị viên. 3. Thay đổi thông tin, mật khẩu, vai trò hoặc trạng thái. 4. Hệ thống mã hóa mật khẩu trước khi lưu. |
| Ngoại lệ       | Email trùng hoặc mật khẩu không đạt yêu cầu: từ chối. Quản trị viên không thể tự khóa hoặc tự hạ quyền tài khoản đang dùng.                                                            |
| Hậu điều kiện  | Tài khoản và quyền truy cập được cập nhật.                                                                                                                                             |

### UC17 — Cấu hình điểm bán

| Thuộc tính     | Nội dung                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tác nhân chính | Quản trị viên                                                                                                                      |
| Mục tiêu       | Thiết lập thông tin xuất hiện trên kiosk và phiếu mua hàng.                                                                        |
| Tiền điều kiện | Quản trị viên đã đăng nhập.                                                                                                        |
| Luồng chính    | 1. Mở thiết lập. 2. Nhập tên điểm bán, địa chỉ, số điện thoại và lời nhắn trên phiếu. 3. Hệ thống kiểm tra độ dài và lưu cấu hình. |
| Ngoại lệ       | Dữ liệu bắt buộc rỗng hoặc vượt giới hạn: từ chối lưu.                                                                             |
| Hậu điều kiện  | Thông tin điểm bán mới được sử dụng trong hệ thống.                                                                                |

## 4. Quy tắc nghiệp vụ dùng chung

1. Giá bán và tổng tiền phải được tính lại tại máy chủ, không tin giá do trình duyệt gửi lên.
2. Không được bán hoặc điều chỉnh làm tồn kho âm.
3. Đơn QR ở trạng thái chờ giữ hàng tối đa 10 phút; hủy hoặc hết hạn phải hoàn tồn.
4. Các thao tác tạo đơn, thanh toán, hủy và hoàn đơn phải có tính lặp an toàn, không trừ/cộng tồn hai lần.
5. Kiosk không cần đăng nhập nhưng chỉ được xem sản phẩm đang bán và không được thấy giá vốn.
6. Tiền mặt chỉ được chọn tại quầy khi Nhân viên hoặc Quản trị viên đã đăng nhập.
7. Chỉ Quản trị viên được thay đổi giá, điều chỉnh kho, hoàn đơn, quản lý tài khoản và cấu hình điểm bán.
8. Thanh toán QR trong prototype là mô phỏng, chưa kết nối ngân hàng thật.
