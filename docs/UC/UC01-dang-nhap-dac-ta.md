# Bảng đặc tả Use Case

<p align="center"><strong><em>Bảng 3.1. Đặc tả Use Case đăng nhập</em></strong></p>

<table>
  <tr>
    <th>Mã use case</th>
    <td>UC01</td>
    <th>Tên use case</th>
    <td>Đăng nhập</td>
  </tr>
  <tr>
    <th>Tác nhân</th>
    <td colspan="3">Nhân viên bán hàng, Quản trị viên/Chủ điểm bán</td>
  </tr>
  <tr>
    <th>Mô tả</th>
    <td colspan="3">Người dùng đăng nhập vào EasyRetail để sử dụng các chức năng phù hợp với quyền được cấp.</td>
  </tr>
  <tr>
    <th>Sự kiện kích hoạt</th>
    <td colspan="3">Người dùng nhấn nút <strong>Đăng nhập</strong> trên giao diện đăng nhập.</td>
  </tr>
  <tr>
    <th>Tiền điều kiện</th>
    <td colspan="3">Người dùng đã có tài khoản đang hoạt động; hệ thống và cơ sở dữ liệu sẵn sàng phục vụ.</td>
  </tr>
  <tr>
    <th rowspan="9">Luồng sự kiện chính<br>(Thành công)</th>
    <th>STT</th>
    <th>Thực hiện bởi</th>
    <th>Hành động</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Người dùng</td>
    <td>Truy cập trang đăng nhập.</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Hệ thống</td>
    <td>Hiển thị giao diện gồm trường Email, Mật khẩu và nút <strong>Đăng nhập</strong>.</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Người dùng</td>
    <td>Nhập email và mật khẩu.</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Người dùng</td>
    <td>Nhấn nút <strong>Đăng nhập</strong>.</td>
  </tr>
  <tr>
    <td>5</td>
    <td>Hệ thống</td>
    <td>Kiểm tra các trường bắt buộc, định dạng email và chuẩn hóa email về chữ thường.</td>
  </tr>
  <tr>
    <td>6</td>
    <td>Hệ thống</td>
    <td>Tìm tài khoản, kiểm tra trạng thái hoạt động và đối chiếu mật khẩu bằng bcrypt.</td>
  </tr>
  <tr>
    <td>7</td>
    <td>Hệ thống</td>
    <td>Tạo JWT có thời hạn 12 giờ và lưu trong cookie <code>HttpOnly</code>, <code>SameSite=Lax</code>.</td>
  </tr>
  <tr>
    <td>8</td>
    <td>Hệ thống</td>
    <td>Hiển thị trang Tổng quan và các chức năng tương ứng với vai trò <code>STAFF</code> hoặc <code>ADMIN</code>.</td>
  </tr>
  <tr>
    <th rowspan="6">Luồng sự kiện<br>thay thế</th>
    <th>STT</th>
    <th>Thực hiện bởi</th>
    <th>Hành động</th>
  </tr>
  <tr>
    <td>5a</td>
    <td>Hệ thống</td>
    <td>Nếu thiếu email, thiếu mật khẩu hoặc email sai định dạng, hệ thống thông báo dữ liệu không hợp lệ và yêu cầu nhập lại.</td>
  </tr>
  <tr>
    <td>6a</td>
    <td>Hệ thống</td>
    <td>Nếu không tìm thấy tài khoản hoặc mật khẩu không đúng, hệ thống không tạo phiên và thông báo: <strong>“Email hoặc mật khẩu không đúng”</strong>.</td>
  </tr>
  <tr>
    <td>6b</td>
    <td>Hệ thống</td>
    <td>Nếu tài khoản bị khóa hoặc vô hiệu hóa, hệ thống không tạo phiên và dùng cùng thông báo đăng nhập không thành công để tránh tiết lộ trạng thái tài khoản.</td>
  </tr>
  <tr>
    <td>6c</td>
    <td>Hệ thống</td>
    <td>Nếu vượt quá 30 yêu cầu đăng nhập trong 15 phút, hệ thống tạm từ chối yêu cầu và đề nghị người dùng thử lại sau.</td>
  </tr>
  <tr>
    <td>E1</td>
    <td>Hệ thống</td>
    <td>Nếu máy chủ hoặc cơ sở dữ liệu gặp lỗi, hệ thống không tạo phiên và thông báo người dùng thử lại sau.</td>
  </tr>
  <tr>
    <th>Hậu điều kiện</th>
    <td colspan="3">Nếu thành công, người dùng có phiên đăng nhập và được truy cập chức năng theo quyền. Nếu thất bại, không có phiên mới được tạo và người dùng vẫn ở trang đăng nhập.</td>
  </tr>
</table>

<p align="center"><strong><em>Bảng 3.2. Dữ liệu chức năng “Đăng nhập”</em></strong></p>

<table>
  <tr>
    <th>STT</th>
    <th>Tên dữ liệu</th>
    <th>Kiểu dữ liệu</th>
    <th>Bắt buộc</th>
    <th>Ràng buộc/Mô tả</th>
  </tr>
  <tr>
    <td>1</td>
    <td>Email</td>
    <td>Chuỗi</td>
    <td>Có</td>
    <td>Đúng định dạng email, tối đa 160 ký tự và không phân biệt chữ hoa/thường.</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Mật khẩu</td>
    <td>Chuỗi</td>
    <td>Có</td>
    <td>Tối đa 100 ký tự trong yêu cầu đăng nhập; được đối chiếu với mật khẩu đã băm bằng bcrypt.</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Thông tin người dùng</td>
    <td>Đối tượng</td>
    <td>Dữ liệu đầu ra</td>
    <td>Gồm mã người dùng, họ tên, email, vai trò và trạng thái hoạt động; không chứa mật khẩu hoặc mã băm.</td>
  </tr>
  <tr>
    <td>4</td>
    <td>Cookie phiên</td>
    <td>JWT</td>
    <td>Dữ liệu đầu ra</td>
    <td>Cookie <code>HttpOnly</code>, <code>SameSite=Lax</code>, có thời hạn 12 giờ.</td>
  </tr>
</table>
