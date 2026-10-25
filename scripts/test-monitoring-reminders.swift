import Foundation

@main struct MonitoringReminderChecks {
 static func main() {
  var calendar=Calendar(identifier: .gregorian);calendar.timeZone=TimeZone(identifier:"Europe/Moscow")!
  let parser=DateFormatter();parser.dateFormat="yyyy-MM-dd HH:mm";parser.locale=Locale(identifier:"en_US_POSIX");parser.timeZone=calendar.timeZone
  let now=parser.date(from:"2026-02-20 12:00")!
  let apartment: [String:Any] = ["id":"flat-a","name":"Демо","settings":["remindersEnabled":true,"leadDays":3],
   "services":[["id":"power","name":"Электричество"]],
   "tasks":[["id":"task","name":"Фильтр","dueDate":"2026-02-25","completedAt":NSNull()],["id":"done","name":"Готово","dueDate":"2026-02-25","completedAt":"2026-02-19"]],
   "meters":[["id":"meter","name":"Счётчик","verificationDate":"2026-03-01","retiredAt":NSNull()]],
   "bills":[["id":"bill","serviceId":"power","amountCents":10000,"adjustmentCents":-1000,"dueDate":"2026-02-26"]],
   "payments":[["billId":"bill","amountCents":4000]],
   "rules":[["id":"rule","name":"Показания","day":31,"enabled":true]],"completions":[]]
  var d:[String:Any] = ["monitoring":["apartments":[apartment]]]
  var result=monitoringReminders(document:d,now:now,calendar:calendar)
  precondition(result.contains { $0.identifier.contains("task.task.") && $0.fire==parser.date(from:"2026-02-22 10:00")! })
  precondition(!result.contains { $0.identifier.contains("task.done.") })
  precondition(result.contains { $0.identifier.contains("rule.rule.2026-02-28") })
  precondition(result.contains { $0.identifier.contains("bill.bill.") })
  precondition(result.contains { $0.identifier.contains("meter.meter.") })
  var second=apartment;second["id"]="flat-b";second["settings"]=["remindersEnabled":false,"leadDays":0]
  d=["monitoring":["apartments":[apartment,second]]];result=monitoringReminders(document:d,now:now,calendar:calendar)
  precondition(result.allSatisfy { $0.apartmentID=="flat-a" })
  var changed=apartment;changed["payments"]=[["billId":"bill","amountCents":11000]]
  changed["completions"]=[["ruleId":"rule","date":"2026-02-28"]]
  changed["meters"]=[["id":"meter","name":"Снятый","verificationDate":"2026-03-01","retiredAt":"2026-02-10"]]
  d=["monitoring":["apartments":[changed]]];result=monitoringReminders(document:d,now:now,calendar:calendar)
  precondition(!result.contains { $0.identifier.contains("bill.bill.") || $0.identifier.contains("meter.meter.") || $0.identifier.contains("rule.rule.2026-02-28") })
  precondition(result.contains { $0.identifier.contains("rule.rule.2026-03-31") })
  precondition(monitoringReminders(document:[:],now:now,calendar:calendar).isEmpty)
  print("Monitoring reminders: partial/overpaid bills, completion, replaced meters, monthly dates, lead time and independent apartment settings passed.")
 }
}
