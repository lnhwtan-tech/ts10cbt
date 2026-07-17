export function removeVietnameseTones(str) {
    if (!str) return '';
    let result = str.toLowerCase();
    result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
    result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
    result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
    result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
    result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
    result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
    result = result.replace(/đ/g, 'd');
    result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return result;
}

export function matchQuery(text, query) {
    if (!text || !query) return false;
    const cleanText = removeVietnameseTones(text);
    const cleanQuery = removeVietnameseTones(query);
    return cleanText.includes(cleanQuery);
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}