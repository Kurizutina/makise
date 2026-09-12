-- Otu-Zan database schema
-- Target: MySQL 8+

CREATE DATABASE IF NOT EXISTS `otu-zan-db`;
USE `otu-zan-db`;

CREATE TABLE IF NOT EXISTS Users (
    UserID INT PRIMARY KEY AUTO_INCREMENT,
    UserName VARCHAR(100) NOT NULL,
    Contact VARCHAR(50),
    Role VARCHAR(50) NOT NULL,
    Email VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Product (
    ProductID INT PRIMARY KEY AUTO_INCREMENT,
    ProductName VARCHAR(150) NOT NULL,
    ProductPrice DECIMAL(10, 2) NOT NULL,
    StockQuantity INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_product_price_nonnegative CHECK (ProductPrice >= 0),
    CONSTRAINT chk_product_stock_nonnegative CHECK (StockQuantity >= 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Orders (
    OrderID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT NOT NULL,
    TotalPrice DECIMAL(10, 2) NOT NULL,
    OrderDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    DeliveryAddress TEXT,
    DeliveryStatus VARCHAR(50) NOT NULL DEFAULT 'pending',
    CONSTRAINT chk_order_total_nonnegative CHECK (TotalPrice >= 0),
    CONSTRAINT fk_orders_user
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS OrderItem (
    OrderItemID INT PRIMARY KEY AUTO_INCREMENT,
    ProductID INT NOT NULL,
    OrderID INT NOT NULL,
    OrderItemPrice DECIMAL(10, 2) NOT NULL,
    ProductQuantity INT NOT NULL,
    CONSTRAINT chk_order_item_price_nonnegative CHECK (OrderItemPrice >= 0),
    CONSTRAINT chk_order_item_quantity_positive CHECK (ProductQuantity > 0),
    CONSTRAINT fk_order_item_product
        FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_order_item_order
        FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Payment (
    PaymentID INT PRIMARY KEY AUTO_INCREMENT,
    OrderID INT NOT NULL,
    PaymentName VARCHAR(100),
    PaymentMethod VARCHAR(50),
    PaymentAmount DECIMAL(10, 2) NOT NULL,
    PaymentStatus VARCHAR(50) NOT NULL DEFAULT 'pending',
    PaymentNote TEXT,
    CONSTRAINT chk_payment_amount_nonnegative CHECK (PaymentAmount >= 0),
    CONSTRAINT fk_payment_order
        FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Queue (
    QueueID INT PRIMARY KEY AUTO_INCREMENT,
    OrderID INT NOT NULL,
    QueuePosition INT,
    QueueStatus VARCHAR(50) NOT NULL DEFAULT 'waiting',
    QueueDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_queue_position_positive CHECK (QueuePosition IS NULL OR QueuePosition > 0),
    CONSTRAINT fk_queue_order
        FOREIGN KEY (OrderID) REFERENCES Orders(OrderID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS Notification (
    NotificationID INT PRIMARY KEY AUTO_INCREMENT,
    UserID INT NOT NULL,
    NotificationMessage TEXT NOT NULL,
    NotificationSeen BOOLEAN NOT NULL DEFAULT FALSE,
    NotificationDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE INDEX idx_orders_user_id ON Orders(UserID);
CREATE INDEX idx_orders_status ON Orders(DeliveryStatus);
CREATE INDEX idx_order_item_order_id ON OrderItem(OrderID);
CREATE INDEX idx_order_item_product_id ON OrderItem(ProductID);
CREATE INDEX idx_payment_order_id ON Payment(OrderID);
CREATE INDEX idx_queue_status_position ON Queue(QueueStatus, QueuePosition);
CREATE INDEX idx_notification_user_seen ON Notification(UserID, NotificationSeen);
