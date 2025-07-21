const units = [
  {count: 31104000000, name: 'year'},
  {count: 2592000000, name: 'month'},
  {count: 604800000, name: 'week'},
  {count: 86400000, name: 'day'},
  {count: 3600000, name: 'hour'},
  {count: 60000, name: 'minute'}
];

const toRelative = time => {
  const delta = new Date() - time;
  const diff = Math.abs(delta);
  const unit = units.find(unit => diff > unit.count) || units[units.length - 1];
  const value = Math.round(diff / unit.count) || 'less than a';
  const str = value + '\u00A0' + unit.name + (value > 1 ? 's' : '');
  return (delta > 0 ? str + '\u00A0ago' : 'in\u00A0' + str);
};

setInterval(() => document.querySelectorAll('time').forEach(time => time.innerHTML = toRelative(Date.parse(time.dateTime))), 30000);

const Time = ({time, className}) => <time className={className} dateTime={time} title={time.toLocaleString()}>{toRelative(time)}</time>;

export default Time;
