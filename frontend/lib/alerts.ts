import Swal from 'sweetalert2';

// Alert untuk Success - Tambah Data
export const alertSuccess = (title: string, message?: string) => {
  return Swal.fire({
    title: title,
    text: message || 'Operasi berhasil dilakukan!',
    icon: 'success',
    confirmButtonText: 'OK',
    confirmButtonColor: '#10b981',
    didOpen: (modal) => {
      modal.classList.add('animate-bounce');
    }
  });
};

// Alert untuk Error
export const alertError = (title: string, message?: string) => {
  return Swal.fire({
    title: title || 'Error!',
    text: message || 'Terjadi kesalahan. Silakan coba lagi.',
    icon: 'error',
    confirmButtonText: 'OK',
    confirmButtonColor: '#ef4444'
  });
};

// Alert untuk Warning/Konfirmasi
export const alertConfirm = (title: string, message?: string, confirmText: string = 'Ya, Hapus') => {
  return Swal.fire({
    title: title,
    text: message || 'Tindakan ini tidak bisa dibatalkan!',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: confirmText,
    cancelButtonText: 'Batal',
    reverseButtons: true
  });
};

// Alert untuk Loading
export const alertLoading = (title: string = 'Loading...') => {
  return Swal.fire({
    title: title,
    icon: 'info',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: async () => {
      Swal.showLoading();
    }
  });
};

// Alert untuk Info/Notifikasi
export const alertInfo = (title: string, message?: string) => {
  return Swal.fire({
    title: title,
    text: message,
    icon: 'info',
    confirmButtonText: 'OK',
    confirmButtonColor: '#3b82f6'
  });
};

// Toast notifikasi (muncul di atas/bawah layar)
export const toastSuccess = (message: string) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  return Toast.fire({
    icon: 'success',
    title: message,
    background: '#dcfce7',
    color: '#15803d'
  });
};

export const toastError = (message: string) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  return Toast.fire({
    icon: 'error',
    title: message,
    background: '#fee2e2',
    color: '#991b1b'
  });
};

export const toastInfo = (message: string) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  });

  return Toast.fire({
    icon: 'info',
    title: message,
    background: '#dbeafe',
    color: '#1e40af'
  });
};
