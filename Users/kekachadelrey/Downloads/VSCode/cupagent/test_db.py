import asyncio
import sys
sys.path.insert(0, '/Users/kekachadelrey/Downloads/VSCode/cupagent')

from storage.database import Database


async def test_remove_chats():
    """Тест метода removeAutoReadChats"""
    db = Database("postgresql://kekachadelrey@localhost:5432/cupagent")
    await db.connect()
    
    # Тест 1: Удаление из пустого списка
    print("Тест 1: Удаление из пустого списка")
    result = await db.removeAutoReadChats(999, [123, 456])
    print(f"Результат: {result}")
    assert result["auto_read_chat_filter_data"]["chats"] == []
    print("✅ Тест 1 пройден\n")
    
    # Тест 2: Удаление из списка с данными
    print("Тест 2: Удаление из списка с данными")
    await db.setAutoReadChatFilter(999, "only", [111, 222, 333, 444])
    result = await db.removeAutoReadChats(999, [222, 444])
    print(f"Результат: {result}")
    assert result["auto_read_chat_filter_data"]["chats"] == [111, 333]
    print("✅ Тест 2 пройден\n")
    
    # Тест 3: Удаление всех чатов
    print("Тест 3: Удаление всех чатов")
    result = await db.removeAutoReadChats(999, [111, 333])
    print(f"Результат: {result}")
    assert result["auto_read_chat_filter_data"]["chats"] == []
    print("✅ Тест 3 пройден\n")
    
    # Тест 4: Добавление чатов
    print("Тест 4: Добавление чатов")
    result = await db.addAutoReadChats(999, [555, 666])
    print(f"Результат: {result}")
    assert result["auto_read_chat_filter_data"]["chats"] == [555, 666]
    print("✅ Тест 4 пройден\n")
    
    # Тест 5: Удаление части чатов после добавления
    print("Тест 5: Удаление части чатов после добавления")
    result = await db.removeAutoReadChats(999, [555])
    print(f"Результат: {result}")
    assert result["auto_read_chat_filter_data"]["chats"] == [666]
    print("✅ Тест 5 пройден\n")
    
    print("🎉 Все тесты пройдены успешно!")
    await db.close()


if __name__ == "__main__":
    asyncio.run(test_remove_chats())
