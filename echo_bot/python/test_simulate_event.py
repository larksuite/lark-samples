import json
import time
from main import do_p2_im_message_receive_v1

# Build a minimal duck-typed object matching expected structure
class SenderID:
    def __init__(self, open_id):
        self.open_id = open_id

class Sender:
    def __init__(self, open_id):
        self.sender_id = SenderID(open_id)

class Message:
    def __init__(self, message_id, chat_id, chat_type, message_type, content):
        self.message_id = message_id
        self.chat_id = chat_id
        self.chat_type = chat_type
        self.message_type = message_type
        self.content = content

class Event:
    def __init__(self, sender, message):
        self.sender = sender
        self.message = message

class Data:
    def __init__(self, event):
        self.event = event

# Simulate a text message containing a link
content = json.dumps({"text": "看看这个链接：https://m.toutiao.com/article/7590734464045597230/  谢谢"})
message = Message(message_id=str(int(time.time())), chat_id="test_chat", chat_type="p2p", message_type="text", content=content)
sender = Sender(open_id="ou_b9532210879f47f08cd00293a534d164")
event = Event(sender, message)
data = Data(event)

print("--- Running simulated event ---")
res = do_p2_im_message_receive_v1(data)
print("Returned response:", getattr(res, 'raw', res))
print("--- Done ---")
