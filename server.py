# -*- coding: utf-8 -*-
"""QRGen — локальный сервер (порт 9000)."""
import http.server
import socketserver
import os
import sys

PORT = 9000
HOST = '127.0.0.1'
DIR = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def end_headers(self):
        # без кеша — чтобы правки сразу подхватывались
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("[QRGen] " + (fmt % args) + "\n")
        sys.stdout.flush()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print('=' * 46)
        print('  QRGen запущен: http://%s:%d/' % (HOST, PORT))
        print('  Папка: %s' % DIR)
        print('  Ctrl+C — остановить')
        print('=' * 46)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nСервер остановлен.')
