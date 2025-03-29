import logging
from logging.handlers import RotatingFileHandler

def setup_logging(app):
    log_handler = RotatingFileHandler(
        'app.log', 
        maxBytes=1024*1024, 
        backupCount=3
    )
    log_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    app.logger.addHandler(log_handler)
    app.logger.setLevel(logging.INFO)